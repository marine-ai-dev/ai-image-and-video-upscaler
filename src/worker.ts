import {
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  MP4,
  QTFF,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  EncodedAudioPacketSource,
  StreamTarget,
  VideoSample,
  VideoSampleSink,
  EncodedPacketSink,
  canEncodeVideo,
} from 'mediabunny';

import WebSR from '@websr/websr';
import { AppError, toMsg } from './lib/app-error';

import type {
  WorkerRequestMessage,
  WorkerResponseMessage,
  InitData,
  Resolution,
  ImageProcessData,
  ImageJobData,
  VideoJobData,
  PassOptions
} from './types/worker-messages';

// Worker state
let gpu: any | false;
let websr: WebSR;
let upscaled_canvas: OffscreenCanvas;
let original_canvas: OffscreenCanvas;
let resolution: Resolution;
let ctx: ImageBitmapRenderingContext | null;

// Default weights
const weights = require('./weights/cnn-2x-m-rl.json');

/** Native scale of every anime4k/cnn-2x-* network shipped with this app. */
const NATIVE_SCALE = 2;

/**
 * Weight JSON blobs are large, so the main thread sends each one once and then
 * refers to it by key. Keeps per-file batch messages small.
 */
const weightsCache = new Map<string, any>();

/**
 * One WebSR instance is bound to one input resolution (its layer graph
 * allocates GPU buffers sized to that resolution at construction). Multi-pass
 * and batch work therefore needs one instance per resolution, and reusing them
 * across passes and files avoids re-initialising the model every time.
 */
interface InstanceEntry {
  websr: WebSR;
  canvas: OffscreenCanvas;
  lastUsed: number;
  pinned: boolean;
  /** Input pixels this instance is built for, used for the bytes/pixel ratio. */
  pixels: number;
  /** Measured GPU bytes held by this instance (buffers + owned textures). */
  bytes: number;
  /** False until the input texture exists (created lazily on first render). */
  measured: boolean;
}

const instanceCache = new Map<string, InstanceEntry>();

/**
 * The cache is bounded by bytes, not by instance count: one 4096x4096 instance
 * holds ~2.7 GiB, so a count-based cap would happily retain many gigabytes.
 */
const MAX_CACHE_BYTES = 1.5 * 1024 ** 3;
const MAX_CACHED_INSTANCES = 6;

/** Derived bytes-per-input-pixel per network, measured from real allocations. */
const networkProfiles = new Map<string, number>();

/**
 * The instance bound to the on-screen preview canvas. Tracked separately from
 * the cache (it owns a canvas the worker does not) so it can be released when a
 * new file is loaded into the same page.
 */
let previewEntry: InstanceEntry | null = null;

/** Cooperative cancellation - checked between passes, files and video frames. */
let cancelRequested = false;

class CancelledError extends Error {
  constructor() {
    super('error.cancelled');
    this.name = 'CancelledError';
  }
}

function throwIfCancelled(): void {
  if (cancelRequested) throw new CancelledError();
}

function log(...args: any[]): void {
  // Detailed diagnostics stay in the worker console; the UI gets plain statuses.
  console.log('[upscaler]', ...args);
}

/**
 * Request the most capable device the adapter offers.
 *
 * The WebGPU defaults (8192px textures, 128 MiB storage buffers) are far too
 * small for multi-pass work: a single 4096x4096 pass needs ~268 MiB per
 * intermediate buffer. WebSR.initWebGPU() requests a device with default
 * limits, so we build the device ourselves and hand it to WebSR, which accepts
 * one via its `gpu` parameter. Falls back to WebSR's own initialisation.
 */
async function ensureGpu(): Promise<any> {
  if (gpu) return gpu;

  const nav: any = navigator as any;
  if (nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) {
        const limits = adapter.limits;
        try {
          gpu = await adapter.requestDevice({
            requiredLimits: {
              maxTextureDimension2D: limits.maxTextureDimension2D,
              maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
              maxBufferSize: limits.maxBufferSize
            }
          });
        } catch (e) {
          log('Falling back to default device limits:', e);
          gpu = await adapter.requestDevice();
        }
      }
    } catch (e) {
      log('requestAdapter failed:', e);
    }
  }

  if (!gpu) gpu = await WebSR.initWebGPU();

  if (gpu) {
    log('GPU limits', {
      maxTextureDimension2D: gpu.limits?.maxTextureDimension2D,
      maxStorageBufferBindingSize: gpu.limits?.maxStorageBufferBindingSize
    });
  }

  return gpu;
}

/**
 * Check if WebGPU is supported in this environment
 */
async function isSupported(): Promise<void> {
  await ensureGpu();

  postMessage({
    cmd: 'isSupported',
    data: gpu !== false && !!gpu,
    caps: gpu && gpu.limits
      ? {
        maxTextureDimension: gpu.limits.maxTextureDimension2D,
        maxStorageBufferBindingSize: gpu.limits.maxStorageBufferBindingSize
      }
      : undefined
  } satisfies WorkerResponseMessage);
}

/**
 * Initialize the worker with canvases and create WebSR instance
 */
async function init(config: InitData): Promise<void> {
  await ensureGpu();

  // A canvas can only be transferred to the worker once, so later loads in the
  // same page reuse the canvases already held here and just resize them.
  if (config.upscaled && config.original) {
    upscaled_canvas = config.upscaled;
    original_canvas = config.original;
    ctx = original_canvas.getContext('bitmaprenderer');
  }

  if (!upscaled_canvas) throw new AppError('error.no_canvas');

  // Release the previous preview instance before replacing it, otherwise its
  // buffers stay allocated for the lifetime of the page.
  if (previewEntry) {
    releaseInstance(previewEntry);
    previewEntry = null;
  }

  upscaled_canvas.width = config.resolution.width * NATIVE_SCALE;
  upscaled_canvas.height = config.resolution.height * NATIVE_SCALE;
  original_canvas.width = config.resolution.width * NATIVE_SCALE;
  original_canvas.height = config.resolution.height * NATIVE_SCALE;

  websr = new WebSR({
    network_name: "anime4k/cnn-2x-m",
    weights,
    resolution: config.resolution,
    gpu: gpu,
    canvas: upscaled_canvas as any // OffscreenCanvas is valid but types may be strict
  });

  previewEntry = {
    websr,
    canvas: upscaled_canvas,
    lastUsed: performance.now(),
    pinned: true,
    pixels: config.resolution.width * config.resolution.height,
    bytes: 0,
    measured: false
  };

  resolution = config.resolution;

  const bitmap2 = await createImageBitmap(config.bitmap, {
    resizeHeight: config.resolution.height * 2,
    resizeWidth: config.resolution.width * 2,
  });

  await renderToUpscaledCanvas(config.bitmap, Boolean(config.preserveAlpha));

  if (ctx) {
    ctx.transferFromImageBitmap(bitmap2);
  }
}

/**
 * Switch to a different AI upscaling network
 */
async function switchNetwork(name: string, networkWeights: any, bitmap: ImageBitmap, preserveAlpha = false): Promise<void> {
  websr.switchNetwork(name as any, networkWeights);

  await renderToUpscaledCanvas(bitmap, preserveAlpha);
}

//===================  Instance cache ===========================

function instanceKey(options: PassOptions, width: number, height: number): string {
  return `${options.name}|${options.weightsKey}|${width}x${height}`;
}

/**
 * Free the GPU memory an instance holds without touching the shared GPUDevice.
 *
 * Note: WebSR.destroy() calls GPUDevice.destroy(), which would kill the device
 * for every other instance too, so it must not be used here. The textures and
 * buffers below are the ones WebGPUContext allocated for this instance; the
 * 'output' entry is the canvas's own texture and is not ours to destroy.
 */
function releaseInstance(entry: InstanceEntry): void {
  const context: any = (entry.websr as any).context;
  if (!context) return;

  for (const [name, texture] of Object.entries(context.textures || {})) {
    if (name === 'output') continue;
    try {
      (texture as GPUTexture).destroy();
    } catch (e) {
      log('texture release failed', name, e);
    }
  }
  for (const buffer of Object.values(context.buffers || {})) {
    try {
      (buffer as GPUBuffer).destroy();
    } catch (e) {
      log('buffer release failed', e);
    }
  }

  // Layers allocate their own uniform buffers via Layer.setUniform, which are
  // kept on the layer rather than in the context - release those too.
  const layers: any[] = (entry.websr as any).network?.layers || [];
  for (const layer of layers) {
    for (const buffer of Object.values(layer.buffers || {})) {
      try {
        (buffer as GPUBuffer).destroy();
      } catch (e) {
        log('uniform buffer release failed', e);
      }
    }
    layer.buffers = {};
    layer.bindGroup = null;
  }

  context.textures = {};
  context.buffers = {};

  // Drop the canvas backing store as well.
  entry.canvas.width = 1;
  entry.canvas.height = 1;
  entry.bytes = 0;
}

/** Actual GPU bytes held by an instance, read from the real allocations. */
function measureInstance(entry: InstanceEntry): number {
  const context: any = (entry.websr as any).context;
  if (!context) return 0;

  let bytes = 0;
  for (const buffer of Object.values(context.buffers || {})) {
    bytes += (buffer as GPUBuffer).size;
  }
  for (const [name, texture] of Object.entries(context.textures || {})) {
    if (name === 'output') continue;
    const tex = texture as GPUTexture;
    bytes += tex.width * tex.height * bytesPerTexel(tex.format);
  }
  // The canvas's own colour attachment.
  bytes += entry.canvas.width * entry.canvas.height * 4;

  return bytes;
}

function bytesPerTexel(format: string): number {
  if (format === 'rgba32float') return 16;
  if (format === 'rgba16float') return 8;
  return 4;
}

function cacheBytes(): number {
  let total = 0;
  for (const entry of instanceCache.values()) total += entry.bytes;
  return total;
}

/**
 * Record how many GPU bytes this network needs per input pixel, so the UI can
 * predict memory use from measured allocations instead of a guessed constant.
 */
function updateProfile(networkName: string, entry: InstanceEntry): void {
  if (!entry.pixels) return;
  const perPixel = entry.bytes / entry.pixels;
  const known = networkProfiles.get(networkName);
  if (known === undefined || perPixel > known) {
    networkProfiles.set(networkName, perPixel);
    postMessage({
      cmd: 'networkProfile',
      data: { name: networkName, bytesPerInputPixel: perPixel }
    } satisfies WorkerResponseMessage);
  }
}

function evictIfNeeded(): void {
  while (instanceCache.size > MAX_CACHED_INSTANCES || cacheBytes() > MAX_CACHE_BYTES) {
    let oldestKey: string | null = null;
    let oldest = Infinity;
    for (const [key, entry] of instanceCache) {
      if (entry.pinned) continue;
      if (entry.lastUsed < oldest) {
        oldest = entry.lastUsed;
        oldestKey = key;
      }
    }
    // Everything left is in use by the running job; stop rather than spin.
    if (!oldestKey) return;
    const entry = instanceCache.get(oldestKey)!;
    log('evicting cached instance', oldestKey, `${(entry.bytes / 1024 ** 2).toFixed(0)} MiB`);
    releaseInstance(entry);
    instanceCache.delete(oldestKey);
  }
}

function getInstance(options: PassOptions, width: number, height: number): InstanceEntry {
  const key = instanceKey(options, width, height);
  const existing = instanceCache.get(key);
  if (existing) {
    existing.lastUsed = performance.now();
    return existing;
  }

  const networkWeights = weightsCache.get(options.weightsKey);
  if (!networkWeights) {
    throw new AppError('error.no_weights', { key: options.weightsKey });
  }

  const canvas = new OffscreenCanvas(width * NATIVE_SCALE, height * NATIVE_SCALE);
  const instance = new WebSR({
    network_name: options.name as any,
    weights: networkWeights,
    resolution: { width, height },
    gpu,
    canvas: canvas as any
  });

  const entry: InstanceEntry = {
    websr: instance,
    canvas,
    lastUsed: performance.now(),
    pinned: false,
    pixels: width * height,
    bytes: 0,
    measured: false
  };
  entry.bytes = measureInstance(entry);
  instanceCache.set(key, entry);
  log('created instance', key, `${(entry.bytes / 1024 ** 2).toFixed(0)} MiB`);

  evictIfNeeded();
  return entry;
}

/**
 * Re-measure once the lazily created input texture exists, so the reported
 * bytes-per-pixel reflects everything the instance really holds.
 */
function finaliseMeasurement(entry: InstanceEntry, networkName: string): void {
  if (entry.measured) return;
  entry.measured = true;
  entry.bytes = measureInstance(entry);
  updateProfile(networkName, entry);
  evictIfNeeded();
}

function releaseAllInstances(): void {
  for (const entry of instanceCache.values()) releaseInstance(entry);
  instanceCache.clear();
}

//===================  Pass chain ===========================

interface ChainStep {
  canvas: OffscreenCanvas;
  render: (source: ImageBitmap | VideoFrame) => Promise<void>;
  entry?: InstanceEntry;
}

/**
 * Build the ordered list of render targets for a multi-pass run.
 *
 * `usePreviewInstance` keeps the first pass on the on-screen preview canvas so
 * the existing single-file preview keeps updating exactly as before; batch jobs
 * run entirely on off-screen canvases.
 */
function buildChain(
  source: Resolution,
  options: PassOptions,
  usePreviewInstance: boolean
): ChainStep[] {
  const steps: ChainStep[] = [];
  let width = source.width;
  let height = source.height;

  for (let pass = 1; pass <= options.passes; pass++) {
    if (pass === 1 && usePreviewInstance) {
      steps.push({
        canvas: upscaled_canvas,
        render: (src) => renderToUpscaledCanvas(src, false)
      });
    } else {
      const entry = getInstance(options, width, height);
      entry.pinned = true;
      steps.push({
        canvas: entry.canvas,
        render: async (src) => {
          await entry.websr.render(src as any);
          finaliseMeasurement(entry, options.name);
        },
        entry
      });
    }
    width *= NATIVE_SCALE;
    height *= NATIVE_SCALE;
  }

  return steps;
}

function unpinChain(steps: ChainStep[]): void {
  for (const step of steps) {
    if (step.entry) step.entry.pinned = false;
  }
}

/**
 * Run a source through every pass, feeding each pass's output into the next.
 *
 * Only one intermediate bitmap is alive at a time - each is closed as soon as
 * the following pass has consumed it.
 */
async function renderChain(
  steps: ChainStep[],
  source: ImageBitmap | VideoFrame,
  preserveAlpha: boolean,
  onPass?: (pass: number, width: number, height: number) => void
): Promise<OffscreenCanvas> {
  let current: ImageBitmap | VideoFrame = source;
  let owned: ImageBitmap | null = null;

  for (let i = 0; i < steps.length; i++) {
    throwIfCancelled();

    // Only the first pass sees the original file's alpha; later passes work on
    // already-composited output.
    const input = i === 0 && preserveAlpha && current instanceof ImageBitmap
      ? createMattedImageBitmap(current)
      : current;

    await steps[i].render(input);

    if (input !== current && input instanceof ImageBitmap) input.close();

    if (owned) {
      owned.close();
      owned = null;
    }

    onPass?.(i + 1, steps[i].canvas.width, steps[i].canvas.height);

    if (i < steps.length - 1) {
      owned = await createImageBitmap(steps[i].canvas);
      current = owned;
    }
  }

  if (owned) owned.close();

  return steps[steps.length - 1].canvas;
}

//===================  Image processing ===========================

/**
 * Upscale a single image and return a blob buffer.
 * Single-pass behaviour is unchanged; `options.passes > 1` chains passes.
 */
async function processImage(data: ImageProcessData): Promise<void> {
  const outputType = data.mimeType || 'image/png';
  const preserveAlpha = outputType === 'image/png';
  const passes = data.options?.passes ?? 1;

  // The bitmap arrives as a structured-clone copy (the main thread keeps its
  // own for the preview), so this worker-side copy must be closed when done or
  // it accumulates across repeated jobs.
  const ownedBitmap = data.bitmap;

  if (passes <= 1) {
    try {
      // Original single-pass path, byte for byte the same as before.
      await renderToUpscaledCanvas(data.bitmap, preserveAlpha);

      const blob = preserveAlpha
        ? await createPngWithOriginalAlpha(data.bitmap)
        : await upscaled_canvas.convertToBlob({ type: outputType });

      const buffer = await blob.arrayBuffer();
      postMessage({
        cmd: 'finishedImage',
        data: buffer,
        mimeType: blob.type,
        width: upscaled_canvas.width,
        height: upscaled_canvas.height
      } satisfies WorkerResponseMessage, [buffer]);
    } finally {
      ownedBitmap.close();
    }
    return;
  }

  const options = data.options!;
  const steps = buildChain({ width: data.bitmap.width, height: data.bitmap.height }, options, true);

  try {
    const finalCanvas = await renderChain(steps, data.bitmap, preserveAlpha, (pass, width, height) => {
      postMessage({ cmd: 'pass', data: { pass, passes: options.passes, width, height } } satisfies WorkerResponseMessage);
      postMessage({ cmd: 'progress', data: Math.round((pass / options.passes) * 100) } satisfies WorkerResponseMessage);
    });

    const blob = await encodeCanvas(finalCanvas, outputType, preserveAlpha ? data.bitmap : null);
    const buffer = await blob.arrayBuffer();

    postMessage({
      cmd: 'finishedImage',
      data: buffer,
      mimeType: blob.type,
      width: finalCanvas.width,
      height: finalCanvas.height
    } satisfies WorkerResponseMessage, [buffer]);
  } finally {
    unpinChain(steps);
    ownedBitmap.close();
  }
}

/** Batch image job: same pipeline, reported against a jobId. */
async function runImageJob(data: ImageJobData): Promise<void> {
  const outputType = data.mimeType || 'image/png';
  const preserveAlpha = data.preserveAlpha ?? outputType === 'image/png';
  const steps = buildChain({ width: data.bitmap.width, height: data.bitmap.height }, data, false);

  log('image job', data.jobId, `${data.bitmap.width}x${data.bitmap.height}`, `${data.passes} pass(es)`, outputType);

  try {
    const finalCanvas = await renderChain(steps, data.bitmap, preserveAlpha, (pass, width, height) => {
      postMessage({
        cmd: 'jobProgress',
        jobId: data.jobId,
        pass,
        passes: data.passes,
        percent: Math.round((pass / data.passes) * 100)
      } satisfies WorkerResponseMessage);
      log('image job', data.jobId, `pass ${pass}/${data.passes} -> ${width}x${height}`);
    });

    const blob = await encodeCanvas(finalCanvas, outputType, preserveAlpha ? data.bitmap : null);
    const buffer = await blob.arrayBuffer();

    postMessage({
      cmd: 'jobDone',
      jobId: data.jobId,
      data: buffer,
      mimeType: blob.type,
      width: finalCanvas.width,
      height: finalCanvas.height
    } satisfies WorkerResponseMessage, [buffer]);
  } finally {
    unpinChain(steps);
    data.bitmap.close();
  }
}

/**
 * Encode a rendered canvas, restoring the source alpha channel for PNG output.
 */
async function encodeCanvas(
  canvas: OffscreenCanvas,
  mimeType: string,
  alphaSource: ImageBitmap | null
): Promise<Blob> {
  if (!alphaSource || mimeType !== 'image/png') {
    return canvas.convertToBlob({ type: mimeType });
  }

  const renderedBlob = await canvas.convertToBlob({ type: 'image/png' });
  const renderedBitmap = await createImageBitmap(renderedBlob);
  try {
    return await composeAlpha(renderedBitmap, alphaSource);
  } finally {
    renderedBitmap.close();
  }
}

async function renderToUpscaledCanvas(source: ImageBitmap | VideoFrame, preserveAlpha = false): Promise<void> {
  const renderSource = preserveAlpha && source instanceof ImageBitmap
    ? createMattedImageBitmap(source)
    : source;

  await websr.render(renderSource as any);

  if (renderSource instanceof ImageBitmap && renderSource !== source) {
    renderSource.close();
  }
}

function createMattedImageBitmap(bitmap: ImageBitmap): ImageBitmap {
  const matteCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const matteCtx = matteCanvas.getContext('2d');

  if (!matteCtx) return bitmap;

  matteCtx.fillStyle = '#fffaf2';
  matteCtx.fillRect(0, 0, matteCanvas.width, matteCanvas.height);
  matteCtx.drawImage(bitmap, 0, 0);

  return matteCanvas.transferToImageBitmap();
}

/**
 * WebSR renders PNG RGB against a light matte; restore the original transparent mask
 * only for the downloaded PNG so the final file keeps a real alpha channel.
 */
async function createPngWithOriginalAlpha(bitmap: ImageBitmap): Promise<Blob> {
  const renderedBlob = await upscaled_canvas.convertToBlob({ type: 'image/png' });
  const renderedBitmap = await createImageBitmap(renderedBlob);
  try {
    return await composeAlpha(renderedBitmap, bitmap);
  } finally {
    renderedBitmap.close();
  }
}

/**
 * Copy the (upscaled) alpha channel of `original` onto the rendered RGB result.
 */
async function composeAlpha(rendered: ImageBitmap, original: ImageBitmap): Promise<Blob> {
  const outputCanvas = new OffscreenCanvas(rendered.width, rendered.height);
  const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!outputCtx) return new Blob([]);

  outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  outputCtx.drawImage(rendered, 0, 0);

  const alphaCanvas = new OffscreenCanvas(outputCanvas.width, outputCanvas.height);
  const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });
  if (!alphaCtx) return outputCanvas.convertToBlob({ type: 'image/png' });

  alphaCtx.imageSmoothingEnabled = true;
  alphaCtx.imageSmoothingQuality = 'high';
  alphaCtx.clearRect(0, 0, alphaCanvas.width, alphaCanvas.height);
  alphaCtx.drawImage(original, 0, 0, alphaCanvas.width, alphaCanvas.height);

  const outputImage = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
  const alphaImage = alphaCtx.getImageData(0, 0, alphaCanvas.width, alphaCanvas.height);

  for (let i = 3; i < outputImage.data.length; i += 4) {
    outputImage.data[i] = alphaImage.data[i];
  }

  outputCtx.putImageData(outputImage, 0, 0);

  return outputCanvas.convertToBlob({ type: 'image/png' });
}

//===================  Video processing ===========================

/**
 * Main video processing function using MediaBunny.
 *
 * Frames are pulled one at a time and released immediately, so the video is
 * never held in memory; multi-pass runs reuse the same chain of canvases for
 * every frame rather than allocating per frame.
 */
async function initRecording(
  inputFile: FileSystemFileHandle | File,
  outputHandle?: FileSystemFileHandle,
  options?: PassOptions,
  jobId?: string
): Promise<void> {

  const passes = Math.max(1, options?.passes ?? 1);
  const usePreviewInstance = !jobId;

  const file = inputFile instanceof File ? inputFile : await inputFile.getFile();

  // MediaBunny handles streaming from the blob for large files
  const source = new BlobSource(file);

  const input = new Input({
    formats: [MP4, QTFF],
    source
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  const audioTrack = await input.getPrimaryAudioTrack();

  if (!videoTrack) {
    throw new AppError('error.no_video_track');
  }

  const decodable = await videoTrack.canDecode();
  if (!decodable) {
    throw new AppError('error.undecodable');
  }

  const inputWidth = videoTrack.displayWidth ?? videoTrack.codedWidth;
  const inputHeight = videoTrack.displayHeight ?? videoTrack.codedHeight;
  const finalWidth = inputWidth * NATIVE_SCALE ** passes;
  const finalHeight = inputHeight * NATIVE_SCALE ** passes;

  // Ask the platform whether it can actually encode this size before spending
  // minutes upscaling frames that could never be muxed.
  const encodable = await canEncodeVideo('avc', { width: finalWidth, height: finalHeight });
  if (!encodable) {
    throw new AppError('error.cannot_encode', { width: finalWidth, height: finalHeight });
  }

  // For batch jobs the worker has no preview canvas, so pass 1 runs off-screen.
  const steps = buildChain({ width: inputWidth, height: inputHeight }, {
    name: options?.name || "anime4k/cnn-2x-m",
    weightsKey: options?.weightsKey || '',
    passes
  }, usePreviewInstance);

  const finalCanvas = steps[steps.length - 1].canvas;

  log('video job', jobId || 'preview', `${inputWidth}x${inputHeight} -> ${finalWidth}x${finalHeight}`, `${passes} pass(es)`);

  let target: BufferTarget | StreamTarget;
  let writer: WritableStream | undefined;

  if (outputHandle) {
    writer = await outputHandle.createWritable();
    target = new StreamTarget(writer);
  } else {
    target = new BufferTarget();
  }

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: target,
  });

  const videoSource = new CanvasSource(finalCanvas, {
    codec: 'avc',
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 60,
  });

  output.addVideoTrack(videoSource, { frameRate: 30 });

  let audioSource;
  let audioSink;

  if (audioTrack) {
    audioSource = new EncodedAudioPacketSource(audioTrack.codec);
    output.addAudioTrack(audioSource);
    audioSink = new EncodedPacketSink(audioTrack);
  }

  await output.start();

  const sink = new VideoSampleSink(videoTrack);
  const duration = await input.computeDuration();
  const start_time = performance.now();

  function reportProgress(sample: VideoSample) {
    const time_elapsed = performance.now() - start_time;
    const progress = Math.floor((sample.timestamp) / duration * 100);

    if (jobId) {
      postMessage({ cmd: 'jobProgress', jobId, pass: passes, passes, percent: progress } satisfies WorkerResponseMessage);
      return;
    }

    postMessage({ cmd: 'progress', data: progress });

    if (time_elapsed > 1000) {
      const processing_rate = ((sample.timestamp) / duration * 100) / time_elapsed;
      const eta = Math.round(((100 - progress) / processing_rate) / 1000);
      postMessage({ cmd: 'eta', data: prettyTime(eta) });
    } else {
      postMessage({ cmd: 'eta', data: 'calculating...' });
    }
  }

  try {
    // Loop over all frames
    for await (const sample of sink.samples()) {
      throwIfCancelled();

      const videoFrame = sample.toVideoFrame();

      // This is for the 'before' preview. Batch jobs have no preview canvas.
      let bitmap: ImageBitmap | null = null;
      if (ctx && usePreviewInstance) {
        bitmap = await createImageBitmap(videoFrame, {
          resizeHeight: videoFrame.codedHeight * 2,
          resizeWidth: videoFrame.codedWidth * 2
        });
      }

      await renderChain(steps, videoFrame, false);

      // Render the "Before"
      if (bitmap) ctx?.transferFromImageBitmap(bitmap);

      videoSource.add(sample.timestamp, sample.duration);

      reportProgress(sample);

      videoFrame.close();
      sample.close();
    }

    if (audioSink) {
      const config = await audioTrack.getDecoderConfig();
      // Pass audio without re-encoding
      for await (const packet of audioSink.packets()) {
        if (packet.timestamp > 0) {
          audioSource.add(packet, { decoderConfig: config });
        }
      }
    }

    await output.finalize();

    if (jobId) {
      const buffer = writer ? null : (output.target as BufferTarget).buffer;
      postMessage(
        { cmd: 'jobDone', jobId, data: buffer, mimeType: 'video/mp4', width: finalWidth, height: finalHeight } satisfies WorkerResponseMessage,
        buffer ? [buffer] : []
      );
    } else if (writer) {
      postMessage({ cmd: 'finished', data: null }, []);
    } else {
      const buffer = (output.target as BufferTarget).buffer;
      postMessage({ cmd: 'finished', data: buffer }, [buffer]);
    }
  } catch (e) {
    // Leave no half-written file behind on cancel/failure.
    try {
      await output.cancel();
    } catch (cancelError) {
      log('output cancel failed', cancelError);
    }
    throw e;
  } finally {
    unpinChain(steps);
  }
}

/**
 * Format seconds into HH:MM:SS or MM:SS
 */
function prettyTime(secs: number): string {
  const sec_num = parseInt(secs.toString(), 10);
  const hours = Math.floor(sec_num / 3600);
  const minutes = Math.floor(sec_num / 60) % 60;
  const seconds = sec_num % 60;

  return [hours, minutes, seconds]
    .map(v => v < 10 ? "0" + v : v)
    .filter((v, i) => v !== "00" || i > 0)
    .join(":");
}

/**
 * Worker message handler with type-safe message routing
 */
self.onmessage = async function (event: MessageEvent<WorkerRequestMessage>) {
  if (!event.data.cmd) return;

  try {
    switch (event.data.cmd) {
      case 'init':
        await init(event.data.data);
        break;

      case 'isSupported':
        await isSupported();
        break;

      case 'registerWeights':
        weightsCache.set(event.data.data.key, event.data.data.weights);
        break;

      case 'process':
        cancelRequested = false;
        await initRecording(event.data.inputHandle, event.data.outputHandle, event.data.options);
        break;

      case 'network':
        await switchNetwork(
          event.data.data.name,
          event.data.data.weights,
          event.data.data.bitmap,
          Boolean(event.data.data.preserveAlpha)
        );
        break;

      case 'processImage':
        cancelRequested = false;
        await processImage(event.data.data);
        break;

      case 'imageJob':
        await runImageJob(event.data.data);
        break;

      case 'videoJob':
        await initRecording(
          event.data.data.input,
          event.data.data.outputHandle,
          event.data.data,
          event.data.data.jobId
        );
        break;

      case 'cancel':
        cancelRequested = true;
        break;

      case 'resetCancel':
        // Without this a cancelled batch would leave the flag set and every
        // later job would abort immediately.
        cancelRequested = false;
        break;

      case 'releaseCache':
        releaseAllInstances();
        break;

      case 'gpuStats':
        postMessage({
          cmd: 'gpuStats',
          data: {
            instances: instanceCache.size,
            bytes: cacheBytes(),
            keys: [...instanceCache.keys()]
          }
        } satisfies WorkerResponseMessage);
        break;
    }
  } catch (error: any) {
    const cancelled = error instanceof CancelledError;
    const message = cancelled ? { key: 'error.cancelled' } : toMsg(error);

    if (!cancelled) log('job failed', error?.message || error, error);

    const request: any = event.data;
    const jobId = request?.data?.jobId;

    if (jobId) {
      postMessage({ cmd: 'jobError', jobId, message, cancelled } satisfies WorkerResponseMessage);
    } else {
      postMessage({ cmd: 'error', data: message } satisfies WorkerResponseMessage);
    }
  }
};
