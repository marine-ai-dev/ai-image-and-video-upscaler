import type { Msg } from './i18n';

/**
 * Pure helpers for multi-pass upscale planning.
 *
 * The authoritative scale factor comes from the WebSR networks this app ships
 * with: `anime4k/cnn-2x-{s,m,l}` all have `NetworkScales === 2`, so one model
 * pass doubles each dimension. Nothing here rescales images on its own - the
 * numbers below only describe what the model natively produces.
 *
 * This module is intentionally DOM-free so it can be unit tested under Node.
 */

/** Native enlargement factor of one model pass (anime4k/cnn-2x-*). */
export const NATIVE_SCALE = 2;

/** Highest number of passes offered in the UI. */
export const MAX_PASSES = 4;

export interface Dimensions {
    width: number;
    height: number;
}

export type UpscaleMode = 'passes' | 'target';

export interface UpscaleSettings {
    mode: UpscaleMode;
    /** Used when mode === 'passes'. */
    passes: number;
    /** Used when mode === 'target': wanted size of the longest edge, in pixels. */
    targetLongEdge: number;
}

export function defaultSettings(): UpscaleSettings {
    return { mode: 'passes', passes: 1, targetLongEdge: 4096 };
}

export function longEdge(d: Dimensions): number {
    return Math.max(d.width, d.height);
}

/**
 * Dimensions after `passes` native model passes. Aspect ratio is preserved by
 * construction because both axes get the same integer factor.
 */
export function dimensionsAfterPasses(source: Dimensions, passes: number): Dimensions {
    const factor = NATIVE_SCALE ** Math.max(0, passes);
    return {
        width: source.width * factor,
        height: source.height * factor
    };
}

/** Dimensions after each individual pass, for the "expected progression" preview. */
export function passProgression(source: Dimensions, passes: number): Dimensions[] {
    const steps: Dimensions[] = [];
    for (let i = 1; i <= Math.max(0, passes); i++) {
        steps.push(dimensionsAfterPasses(source, i));
    }
    return steps;
}

export interface TargetPlan {
    /** Number of native passes chosen. */
    passes: number;
    /** What the model will actually produce. */
    result: Dimensions;
    /** Long edge the user asked for. */
    requestedLongEdge: number;
    /** True when the native result lands exactly on the request. */
    exact: boolean;
    /** True when `maxPasses` stopped us short of the request. */
    cappedByMaxPasses: boolean;
    /** True when the source already meets or exceeds the request. */
    alreadyAtOrAboveTarget: boolean;
}

/**
 * Work out how many native passes are needed to reach a requested long edge.
 *
 * Rule: the smallest pass count whose native result reaches or exceeds the
 * request, clamped to [1, maxPasses]. We never resample between or after
 * passes, so the result is whatever the model natively produces - the caller is
 * expected to show both the request and the native result when they differ.
 */
export function planForTarget(
    source: Dimensions,
    requestedLongEdge: number,
    maxPasses: number = MAX_PASSES
): TargetPlan {
    const sourceLong = longEdge(source);
    const target = Math.max(1, Math.floor(requestedLongEdge));

    let passes = 1;
    let cappedByMaxPasses = false;
    const alreadyAtOrAboveTarget = sourceLong >= target;

    if (alreadyAtOrAboveTarget) {
        passes = 1;
    } else {
        let candidate = 1;
        while (sourceLong * NATIVE_SCALE ** candidate < target && candidate < maxPasses) {
            candidate++;
        }
        if (sourceLong * NATIVE_SCALE ** candidate < target) cappedByMaxPasses = true;
        passes = candidate;
    }

    const result = dimensionsAfterPasses(source, passes);

    return {
        passes,
        result,
        requestedLongEdge: target,
        exact: longEdge(result) === target,
        cappedByMaxPasses,
        alreadyAtOrAboveTarget
    };
}

/** Resolve the effective pass count for either mode. */
export function resolvePasses(
    source: Dimensions,
    settings: UpscaleSettings,
    maxPasses: number = MAX_PASSES
): number {
    if (settings.mode === 'target') {
        return planForTarget(source, settings.targetLongEdge, maxPasses).passes;
    }
    return Math.min(Math.max(1, Math.round(settings.passes)), maxPasses);
}

/** Final dimensions for either mode. */
export function resolveFinalDimensions(
    source: Dimensions,
    settings: UpscaleSettings,
    maxPasses: number = MAX_PASSES
): Dimensions {
    return dimensionsAfterPasses(source, resolvePasses(source, settings, maxPasses));
}

//=================== Resource safety ===========================

export interface DeviceCaps {
    /** GPUDevice.limits.maxTextureDimension2D - hard cap on any pass output. */
    maxTextureDimension: number;
    /** GPUDevice.limits.maxStorageBufferBindingSize - caps a pass's intermediate buffers. */
    maxStorageBufferBindingSize: number;
}

export const FALLBACK_DEVICE_CAPS: DeviceCaps = {
    // WebGPU spec defaults, used until the worker reports the real device limits.
    maxTextureDimension: 8192,
    maxStorageBufferBindingSize: 128 * 1024 * 1024
};

/**
 * Fallback bytes-per-input-pixel per network, from the layer graphs in
 * @websr/websr (each intermediate buffer is rgba32float = 16 B/px).
 *
 * These are only used until the worker reports a *measured* figure for the
 * network in use - see `bytesPerInputPixel` on SafetyInput.
 */
const NETWORK_BUFFERS: Record<string, number> = {
    small: 4,
    medium: 10,
    large: 5
};

const BYTES_PER_BUFFER_PIXEL = 16;

/**
 * Bytes per *output* pixel needed to turn the final canvas into a file.
 * PNG output goes through the alpha-compose step, which holds two canvases and
 * two ImageData buffers at full output size (4 B/px each); other formats only
 * need the canvas itself.
 */
const ENCODE_BYTES_PER_OUTPUT_PIXEL_PNG = 20;
const ENCODE_BYTES_PER_OUTPUT_PIXEL = 8;

/**
 * Fraction of the memory budget at which we start telling the user the job is
 * heavy. Deliberately well below the block threshold so the warning appears
 * before the last step that would be refused.
 */
const WARN_BUDGET_FRACTION = 0.2;

export type SafetyLevel = 'ok' | 'warn' | 'block';

export interface SafetyReport {
    level: SafetyLevel;
    finalDimensions: Dimensions;
    megapixels: number;
    /** Rough peak GPU memory for the heaviest pass. */
    estimatedGpuBytes: number;
    /** Translatable reasons, most important first. */
    reasons: Msg[];
    /** Largest pass count that stays inside the device limits (0 = none possible). */
    maxSafePasses: number;
}

export interface SafetyInput {
    source: Dimensions;
    passes: number;
    networkSize?: string;
    caps?: DeviceCaps;
    /** Warn above this many output megapixels. */
    warnMegapixels?: number;
    /**
     * Measured GPU bytes per input pixel for the selected network, reported by
     * the worker after it has actually allocated one. Overrides the fallback.
     */
    bytesPerInputPixel?: number;
    /**
     * Working-memory ceiling for a single job. When omitted, only hard device
     * limits are checked (no memory-based warning or block).
     */
    memoryBudgetBytes?: number;
    /** PNG output needs the alpha-compose buffers; other formats do not. */
    pngOutput?: boolean;
}

/**
 * Peak working memory for a run of `passes` passes.
 *
 * Every pass in a chain is held at once: each pass's WebSR instance is pinned
 * for the duration of the job, so their buffers coexist. On top of that sits
 * the final canvas and the encode/alpha-compose buffers at output size.
 */
export function estimatePeakBytes(
    source: Dimensions,
    passes: number,
    bytesPerInputPixel: number,
    pngOutput: boolean = true
): number {
    let instances = 0;
    for (let pass = 1; pass <= passes; pass++) {
        const passInput = dimensionsAfterPasses(source, pass - 1);
        instances += passInput.width * passInput.height * bytesPerInputPixel;
    }

    const output = dimensionsAfterPasses(source, passes);
    const encode = output.width * output.height *
        (pngOutput ? ENCODE_BYTES_PER_OUTPUT_PIXEL_PNG : ENCODE_BYTES_PER_OUTPUT_PIXEL);

    return instances + encode;
}

/** Half of the device's reported RAM, as a working ceiling for one job. */
export function memoryBudgetFor(deviceMemoryGb: number | undefined): number {
    const gb = deviceMemoryGb && deviceMemoryGb > 0 ? deviceMemoryGb : 4;
    return gb * 1024 ** 3 * 0.5;
}

/**
 * Check a planned job against the real device limits.
 *
 * `block` is only ever raised by an actual hardware limit (texture dimension or
 * storage-buffer binding size), never by an invented ceiling. `warn` is advisory
 * so the user can still make an informed decision.
 */
export function evaluateSafety(input: SafetyInput): SafetyReport {
    const caps = input.caps || FALLBACK_DEVICE_CAPS;
    const fallbackPerPixel =
        (NETWORK_BUFFERS[input.networkSize || 'medium'] ?? NETWORK_BUFFERS.medium) * BYTES_PER_BUFFER_PIXEL;
    const bytesPerInputPixel = input.bytesPerInputPixel && input.bytesPerInputPixel > 0
        ? input.bytesPerInputPixel
        : fallbackPerPixel;
    const warnMegapixels = input.warnMegapixels ?? 64;
    const budget = input.memoryBudgetBytes;
    const pngOutput = input.pngOutput ?? true;

    const reasons: Msg[] = [];
    let level: SafetyLevel = 'ok';

    // Highest pass count that satisfies both the hard device limits and, when a
    // budget is known, the projected working memory.
    let maxSafePasses = 0;
    for (let p = 1; p <= Math.max(input.passes, MAX_PASSES); p++) {
        const passInput = dimensionsAfterPasses(input.source, p - 1);
        const passOutput = dimensionsAfterPasses(input.source, p);
        const bufferBytes = passInput.width * passInput.height * BYTES_PER_BUFFER_PIXEL;
        const fitsTexture = Math.max(passOutput.width, passOutput.height) <= caps.maxTextureDimension;
        const fitsBuffer = bufferBytes <= caps.maxStorageBufferBindingSize;
        const fitsMemory = budget === undefined ||
            estimatePeakBytes(input.source, p, bytesPerInputPixel, pngOutput) <= budget;

        if (fitsTexture && fitsBuffer && fitsMemory) maxSafePasses = p;
        else break;
    }

    const finalDimensions = dimensionsAfterPasses(input.source, input.passes);
    const megapixels = (finalDimensions.width * finalDimensions.height) / 1e6;
    const estimatedGpuBytes = estimatePeakBytes(input.source, input.passes, bytesPerInputPixel, pngOutput);

    if (input.passes > maxSafePasses) {
        level = 'block';
        const limitPass = maxSafePasses + 1;
        const blocked = dimensionsAfterPasses(input.source, limitPass);
        const blockedInput = dimensionsAfterPasses(input.source, limitPass - 1);
        const blockedBufferBytes = blockedInput.width * blockedInput.height * BYTES_PER_BUFFER_PIXEL;

        if (Math.max(blocked.width, blocked.height) > caps.maxTextureDimension) {
            reasons.push({ key: 'safety.block_texture', params: {
                pass: limitPass,
                width: blocked.width,
                height: blocked.height,
                limit: caps.maxTextureDimension
            } });
        } else if (blockedBufferBytes > caps.maxStorageBufferBindingSize) {
            reasons.push({ key: 'safety.block_buffer', params: {
                pass: limitPass,
                needed: formatBytes(blockedBufferBytes),
                limit: formatBytes(caps.maxStorageBufferBindingSize)
            } });
        } else {
            // Memory block: describe what the user actually selected, not just
            // the first pass that tipped over the limit.
            reasons.push({ key: 'safety.block_memory', params: {
                passes: input.passes,
                needed: formatBytes(estimatePeakBytes(input.source, input.passes, bytesPerInputPixel, pngOutput)),
                width: finalDimensions.width,
                height: finalDimensions.height,
                budget: formatBytes(budget!)
            } });
        }

        reasons.push(maxSafePasses > 0
            ? { key: 'safety.supports_up_to', params: {
                passes: maxSafePasses,
                size: formatDimensions(dimensionsAfterPasses(input.source, maxSafePasses))
            } }
            : { key: 'safety.too_large' });
    } else if (budget !== undefined && estimatedGpuBytes > budget * WARN_BUDGET_FRACTION) {
        level = 'warn';
        reasons.push({ key: 'safety.warn_memory', params: {
            width: finalDimensions.width,
            height: finalDimensions.height,
            mp: megapixels.toFixed(1),
            needed: formatBytes(estimatedGpuBytes),
            budget: formatBytes(budget)
        } });
    } else if (megapixels > warnMegapixels) {
        level = 'warn';
        reasons.push({ key: 'safety.warn_size', params: {
            width: finalDimensions.width,
            height: finalDimensions.height,
            mp: megapixels.toFixed(1),
            needed: formatBytes(estimatedGpuBytes)
        } });
    }

    return { level, finalDimensions, megapixels, estimatedGpuBytes, reasons, maxSafePasses };
}

/** Rough uncompressed size of a decoded frame/image, for storage warnings. */
export function estimateRawBytes(d: Dimensions): number {
    return d.width * d.height * 4;
}

export function formatBytes(bytes: number, dp: number = 1): string {
    const thresh = 1024;
    if (!Number.isFinite(bytes)) return '?';
    if (Math.abs(bytes) < thresh) return `${Math.round(bytes)} B`;
    const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
    let u = -1;
    const r = 10 ** dp;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
    return `${bytes.toFixed(dp)} ${units[u]}`;
}

export function formatDimensions(d: Dimensions): string {
    return `${d.width} x ${d.height}`;
}
