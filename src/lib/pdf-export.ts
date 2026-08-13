/**
 * Optional post-processing step: collect processed images into a PDF.
 *
 * Uses pdf-lib because it embeds JPEG bytes verbatim (DCTDecode passthrough -
 * no recompression at all) and PNG losslessly, which matters for a tool whose
 * whole point is image quality.
 *
 * Page geometry: one page per image, sized to the image's own pixel dimensions
 * (1px -> 1pt), so the image always fills its page and is never stretched. Very
 * large pages are scaled down uniformly to stay inside the PDF format's 14400pt
 * page limit - that changes the page box only, never the embedded pixels.
 */

import { PDFDocument } from 'pdf-lib';

export type PdfQuality = 'maximum' | 'balanced';

export interface PdfImageInput {
    name: string;
    mime: string;
    width: number;
    height: number;
    /**
     * Resolved one image at a time so a batch's worth of full-resolution files
     * is never held in memory simultaneously.
     */
    load: () => Promise<Uint8Array>;
}

/**
 * Warn above this estimated PDF size - at Maximum quality a batch of large
 * images can easily produce a file that is awkward to open or share.
 */
const LARGE_PDF_WARNING_BYTES = 500 * 1024 * 1024;

export interface PdfBuildResult {
    bytes: Uint8Array;
    pageCount: number;
    /** Anything that changed the images on the way in, so it is never silent. */
    notes: string[];
}

/** PDF page boxes may not exceed 14400 units per side. */
const MAX_PAGE_POINTS = 14400;

/**
 * Above this, lossless embedding decodes to a raw buffer big enough to be a
 * real memory risk in a browser tab (40 MP RGBA is ~160 MB before compression),
 * so "Maximum" downgrades to high-quality JPEG and says so.
 */
const MAX_LOSSLESS_PIXELS = 40e6;

const MAXIMUM_JPEG_FALLBACK_QUALITY = 0.95;
const BALANCED_JPEG_QUALITY = 0.85;

export async function buildImagePdf(
    images: PdfImageInput[],
    options: { quality?: PdfQuality } = {}
): Promise<PdfBuildResult> {
    const quality = options.quality || 'maximum';
    const notes: string[] = [];

    const pdf = await PDFDocument.create();
    pdf.setProducer('Free AI Video & Image Upscaler');
    pdf.setCreator('Free AI Video & Image Upscaler');

    let pageCount = 0;
    let embeddedBytes = 0;

    for (const image of images) {
        // Load, convert, embed, then drop this image's bytes before the next.
        const source = await image.load();
        const prepared = await prepareForEmbedding(image, source, quality, notes);

        const embedded = prepared.mime === 'image/jpeg'
            ? await pdf.embedJpg(prepared.bytes)
            : await pdf.embedPng(prepared.bytes);

        const { pageWidth, pageHeight } = pageSizeFor(embedded.width, embedded.height, notes, image.name);

        const page = pdf.addPage([pageWidth, pageHeight]);
        page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
        pageCount++;
        embeddedBytes += prepared.bytes.length;
    }

    if (embeddedBytes > LARGE_PDF_WARNING_BYTES) {
        notes.push(
            `This PDF contains about ${(embeddedBytes / 1024 ** 2).toFixed(0)} MiB of image data ` +
            '- consider "Balanced" quality if the file is too large to open or share comfortably.'
        );
    }

    const bytes = await pdf.save();
    return { bytes, pageCount, notes };
}

/**
 * Page box in points, preserving the image aspect ratio exactly. Only the box
 * shrinks when an image is enormous; the embedded image data is untouched.
 */
function pageSizeFor(
    width: number,
    height: number,
    notes: string[],
    name: string
): { pageWidth: number; pageHeight: number } {
    const longest = Math.max(width, height);
    if (longest <= MAX_PAGE_POINTS) {
        return { pageWidth: width, pageHeight: height };
    }

    const factor = MAX_PAGE_POINTS / longest;
    notes.push(
        `${name}: page box scaled to the PDF ${MAX_PAGE_POINTS}pt limit ` +
        `(full ${width}x${height} pixel data is still embedded).`
    );
    return {
        pageWidth: Math.floor(width * factor),
        pageHeight: Math.floor(height * factor)
    };
}

/**
 * Get bytes into a format pdf-lib can embed, re-encoding only when we must and
 * recording a note whenever we do.
 */
async function prepareForEmbedding(
    image: PdfImageInput,
    sourceBytes: Uint8Array,
    quality: PdfQuality,
    notes: string[]
): Promise<{ bytes: Uint8Array; mime: string }> {
    const pixels = image.width * image.height;

    // JPEG in, JPEG out: pdf-lib stores the original bytes, so there is nothing
    // to gain from touching them in either quality mode.
    if (image.mime === 'image/jpeg') {
        return { bytes: sourceBytes, mime: 'image/jpeg' };
    }

    if (quality === 'maximum') {
        if (image.mime === 'image/png' && pixels <= MAX_LOSSLESS_PIXELS) {
            return { bytes: sourceBytes, mime: 'image/png' };
        }
        if (image.mime === 'image/png') {
            notes.push(
                `${image.name}: ${(pixels / 1e6).toFixed(0)} MP is too large to embed losslessly, ` +
                `used JPEG quality ${MAXIMUM_JPEG_FALLBACK_QUALITY} instead.`
            );
            return {
                bytes: await reencode(sourceBytes, 'image/jpeg', MAXIMUM_JPEG_FALLBACK_QUALITY),
                mime: 'image/jpeg'
            };
        }
        // WebP (or anything else): pdf-lib cannot embed it, so convert.
        if (pixels <= MAX_LOSSLESS_PIXELS) {
            notes.push(`${image.name}: converted from ${image.mime} to PNG for the PDF (lossless).`);
            return { bytes: await reencode(sourceBytes, 'image/png'), mime: 'image/png' };
        }
        notes.push(
            `${image.name}: converted from ${image.mime} to JPEG quality ${MAXIMUM_JPEG_FALLBACK_QUALITY} for the PDF.`
        );
        return {
            bytes: await reencode(sourceBytes, 'image/jpeg', MAXIMUM_JPEG_FALLBACK_QUALITY),
            mime: 'image/jpeg'
        };
    }

    notes.push(`${image.name}: encoded as JPEG quality ${BALANCED_JPEG_QUALITY} (Balanced PDF quality).`);
    return {
        bytes: await reencode(sourceBytes, 'image/jpeg', BALANCED_JPEG_QUALITY),
        mime: 'image/jpeg'
    };
}

async function reencode(bytes: Uint8Array, targetMime: string, quality?: number): Promise<Uint8Array> {
    const blob = new Blob([bytes as any]);
    const bitmap = await createImageBitmap(blob);

    try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Unable to get a 2D context for PDF image conversion');

        if (targetMime === 'image/jpeg') {
            // JPEG has no alpha; matte on white so transparent areas do not go black.
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(bitmap, 0, 0);

        const out = await canvas.convertToBlob(
            quality === undefined ? { type: targetMime } : { type: targetMime, quality }
        );
        return new Uint8Array(await out.arrayBuffer());
    } finally {
        bitmap.close();
    }
}

export function defaultPdfName(batchName: string): string {
    const cleaned = (batchName || 'batch').replace(/[\\/:*?"<>|]/g, '_').trim() || 'batch';
    return `${cleaned}_upscaled.pdf`;
}
