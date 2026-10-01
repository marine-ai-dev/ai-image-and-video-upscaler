/**
 * Browser-side pieces of the upscale pipeline that do not depend on the
 * worker's state: edge padding / cropping around one model pass, the
 * multi-pass render chain, and the PNG alpha handling.
 *
 * They live here, rather than in worker.ts, so the browser reference harness
 * (api/tests/tools/browser_reference) runs exactly this code to capture the
 * references the API is tested against. Nothing in this file touches `self`,
 * `document` or any global at import time, so it can also be imported from
 * Node tests (the geometry itself is unit tested through upscale-math).
 */

import { passGeometry } from './upscale-math';
import type { Dimensions, PassGeometry } from './upscale-math';

/** Anything the networks accept as a frame. */
export type PassSource = ImageBitmap | VideoFrame;

/**
 * One model pass's view of the world: logical input size in, logical output
 * size out, with the multiple-of-8 padding handled transparently in between.
 *
 * WebSR dispatches `floor(size / 8)` workgroups, so the network is built at
 * `geometry.padded`, fed an input padded to that size by replicating its edge
 * pixels, and its (padded x 2) canvas is cropped back to `geometry.crop`.
 * When the input is already a multiple of 8 on both sides every method is a
 * pass-through and no extra copy is made.
 */
export class PassFrame {
    readonly geometry: PassGeometry;
    private paddedCanvas: OffscreenCanvas | null = null;
    private paddedCtx: OffscreenCanvasRenderingContext2D | null = null;
    private croppedCanvas: OffscreenCanvas | null = null;
    private croppedCtx: OffscreenCanvasRenderingContext2D | null = null;

    constructor(input: Dimensions) {
        this.geometry = passGeometry(input);
    }

    get padding(): boolean {
        return this.geometry.padding;
    }

    /**
     * The frame to hand to `WebSR.render()`. Returns `source` itself when no
     * padding is needed (zero cost: a video frame keeps its zero-copy external
     * texture path); otherwise a new ImageBitmap of the padded size that the
     * caller must close.
     */
    prepareInput(source: PassSource): PassSource {
        if (!this.geometry.padding) return source;

        const { input, padded } = this.geometry;
        if (!this.paddedCanvas) {
            this.paddedCanvas = new OffscreenCanvas(padded.width, padded.height);
            this.paddedCtx = this.paddedCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
        }
        const ctx = this.paddedCtx;
        if (!ctx) throw new Error('2D canvas unavailable for edge padding');

        // Nearest-neighbour everywhere: padding pixels must be exact copies of
        // the edge pixels, never a blend.
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, padded.width, padded.height);
        ctx.drawImage(source as CanvasImageSource, 0, 0, input.width, input.height);

        // Replicate the last column to the right, then the last row (including
        // the freshly padded corner) downwards.
        if (padded.width > input.width) {
            ctx.drawImage(
                this.paddedCanvas,
                input.width - 1, 0, 1, input.height,
                input.width, 0, padded.width - input.width, input.height
            );
        }
        if (padded.height > input.height) {
            ctx.drawImage(
                this.paddedCanvas,
                0, input.height - 1, padded.width, 1,
                0, input.height, padded.width, padded.height - input.height
            );
        }

        return this.paddedCanvas.transferToImageBitmap();
    }

    /**
     * The canvas holding the logical result, without copying pixels into it.
     * `networkCanvas` itself when no cropping is needed. Use it to set up an
     * encoder before the first frame; call `outputCanvas` to fill it.
     */
    target(networkCanvas: OffscreenCanvas): OffscreenCanvas {
        if (!this.geometry.padding) return networkCanvas;
        return this.ensureCropped().canvas;
    }

    /** The network canvas cropped to exactly 2W x 2H (the canvas itself when aligned). */
    outputCanvas(networkCanvas: OffscreenCanvas): OffscreenCanvas {
        if (!this.geometry.padding) return networkCanvas;
        const { canvas, ctx } = this.ensureCropped();
        const { crop } = this.geometry;
        ctx.drawImage(networkCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
        return canvas;
    }

    /** The cropped result as a bitmap, e.g. to feed the next pass. */
    outputBitmap(networkCanvas: OffscreenCanvas): Promise<ImageBitmap> {
        if (!this.geometry.padding) return createImageBitmap(networkCanvas);
        const { crop } = this.geometry;
        return createImageBitmap(networkCanvas, crop.x, crop.y, crop.width, crop.height);
    }

    private ensureCropped(): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
        if (!this.croppedCanvas || !this.croppedCtx) {
            const { crop } = this.geometry;
            this.croppedCanvas = new OffscreenCanvas(crop.width, crop.height);
            this.croppedCtx = this.croppedCanvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D | null;
            if (!this.croppedCtx) throw new Error('2D canvas unavailable for output cropping');
            this.croppedCtx.imageSmoothingEnabled = false;
        }
        return { canvas: this.croppedCanvas, ctx: this.croppedCtx };
    }

    /** Release the scratch canvases' backing stores. */
    dispose(): void {
        for (const canvas of [this.paddedCanvas, this.croppedCanvas]) {
            if (canvas) {
                canvas.width = 1;
                canvas.height = 1;
            }
        }
        this.paddedCanvas = this.paddedCtx = this.croppedCanvas = this.croppedCtx = null;
    }
}

export interface ChainStep {
    /** Geometry + padding/cropping for this pass. */
    frame: PassFrame;
    /** The canvas the pass's WebSR instance renders into (padded size). */
    canvas: OffscreenCanvas;
    /** Render one frame that `frame.prepareInput` already produced. */
    render: (source: PassSource) => Promise<void>;
}

export interface ChainOptions {
    /** Matte the first pass's input over #fffaf2 (PNG output with alpha). */
    preserveAlpha: boolean;
    /** Called after every pass with the pass's logical output size. */
    onPass?: (pass: number, width: number, height: number) => void;
    /** Throws to abort between passes. */
    checkCancelled?: () => void;
}

/**
 * Run a source through every pass, feeding each pass's cropped output into the
 * next. Only one intermediate bitmap is alive at a time. Returns the canvas
 * holding the logical (cropped) final result.
 */
export async function renderChain(
    steps: ChainStep[],
    source: PassSource,
    options: ChainOptions
): Promise<OffscreenCanvas> {
    let current: PassSource = source;
    let owned: ImageBitmap | null = null;

    for (let i = 0; i < steps.length; i++) {
        options.checkCancelled?.();
        const step = steps[i];

        // Only the first pass sees the original file's alpha; later passes work on
        // already-composited output.
        const matted = i === 0 && options.preserveAlpha && current instanceof ImageBitmap
            ? createMattedImageBitmap(current)
            : current;

        const input = step.frame.prepareInput(matted);
        if (matted !== current && matted !== input && matted instanceof ImageBitmap) matted.close();

        await step.render(input);

        if (input !== current && input instanceof ImageBitmap) input.close();

        if (owned) {
            owned.close();
            owned = null;
        }

        options.onPass?.(i + 1, step.frame.geometry.output.width, step.frame.geometry.output.height);

        if (i < steps.length - 1) {
            owned = await step.frame.outputBitmap(step.canvas);
            current = owned;
        }
    }

    if (owned) owned.close();

    const last = steps[steps.length - 1];
    return last.frame.outputCanvas(last.canvas);
}

//===================  Alpha ===========================

export const MATTE_COLOUR = '#fffaf2';

/** Composite a bitmap over the light matte, so the network sees opaque RGB. */
export function createMattedImageBitmap(bitmap: ImageBitmap): ImageBitmap {
    const matteCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const matteCtx = matteCanvas.getContext('2d');

    if (!matteCtx) return bitmap;

    matteCtx.fillStyle = MATTE_COLOUR;
    matteCtx.fillRect(0, 0, matteCanvas.width, matteCanvas.height);
    matteCtx.drawImage(bitmap, 0, 0);

    return matteCanvas.transferToImageBitmap();
}

/**
 * Copy the (upscaled) alpha channel of `original` onto the rendered RGB result.
 */
export async function composeAlpha(rendered: ImageBitmap, original: ImageBitmap): Promise<Blob> {
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

/**
 * Encode a rendered canvas, restoring the source alpha channel for PNG output.
 */
export async function encodeCanvas(
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
