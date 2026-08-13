/**
 * File classification and output naming for single/multi/folder input.
 *
 * Supported formats are limited to what the existing pipeline can actually
 * handle: images go through `createImageBitmap` + OffscreenCanvas encoding,
 * videos go through mediabunny's ISOBMFF/QuickTime demuxers into an MP4 muxer.
 *
 * DOM-free so it can be unit tested under Node.
 */

export type MediaKind = 'image' | 'video' | 'unsupported';

/** Decodable by createImageBitmap and encodable by OffscreenCanvas.convertToBlob. */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;

/** Demuxable by the mediabunny input formats registered in the worker. */
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v'] as const;

export function extensionOf(name: string): string {
    const match = /\.([^.\/\\]+)$/.exec(name);
    return match ? match[1].toLowerCase() : '';
}

export function baseNameOf(name: string): string {
    return name.replace(/\.[^.\/\\]+$/, '');
}

/** Hidden/system entries we quietly skip when scanning folders. */
export function isHiddenFile(name: string): boolean {
    return name.startsWith('.') || name === 'Thumbs.db' || name === 'desktop.ini';
}

export function classifyFile(name: string): MediaKind {
    const ext = extensionOf(name);
    if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return 'image';
    if ((VIDEO_EXTENSIONS as readonly string[]).includes(ext)) return 'video';
    return 'unsupported';
}

/**
 * Output MIME for an image. PNG and WebP stay themselves (lossless / as-is),
 * JPEG stays JPEG. Anything else is written as PNG.
 */
export function outputMimeForImage(name: string): string {
    switch (extensionOf(name)) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'webp':
            return 'image/webp';
        default:
            return 'image/png';
    }
}

export function extensionForMime(mime: string): string {
    switch (mime) {
        case 'image/jpeg':
            return 'jpg';
        case 'image/webp':
            return 'webp';
        case 'video/mp4':
            return 'mp4';
        default:
            return 'png';
    }
}

/**
 * `photo.png` + 4096x4096 -> `photo_upscaled_4096x4096.png`.
 * Describes the real output resolution rather than making quality claims.
 */
export function buildOutputName(
    originalName: string,
    dimensions: { width: number; height: number },
    extension: string
): string {
    return `${baseNameOf(originalName)}_upscaled_${dimensions.width}x${dimensions.height}.${extension}`;
}

/**
 * Avoid silently overwriting an existing result: `name.png` -> `name (2).png`.
 * `taken` is mutated so sequential callers keep getting fresh names.
 */
export function uniqueName(name: string, taken: Set<string>): string {
    if (!taken.has(name)) {
        taken.add(name);
        return name;
    }
    const base = baseNameOf(name);
    const ext = extensionOf(name);
    const suffix = ext ? `.${ext}` : '';
    let n = 2;
    let candidate = `${base} (${n})${suffix}`;
    while (taken.has(candidate)) {
        n++;
        candidate = `${base} (${n})${suffix}`;
    }
    taken.add(candidate);
    return candidate;
}

/**
 * Natural ordering so `page_2` sorts before `page_10`.
 */
export function naturalCompare(a: string, b: string): number {
    const chunk = /(\d+|\D+)/g;
    const aParts = a.toLowerCase().match(chunk) || [];
    const bParts = b.toLowerCase().match(chunk) || [];

    const len = Math.min(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
        const ap = aParts[i];
        const bp = bParts[i];
        const aNum = /^\d/.test(ap);
        const bNum = /^\d/.test(bp);

        if (aNum && bNum) {
            const diff = parseInt(ap, 10) - parseInt(bp, 10);
            if (diff !== 0) return diff;
            // Same value, different padding ("01" vs "1"): keep it deterministic.
            if (ap !== bp) return ap.length - bp.length;
        } else if (ap !== bp) {
            return ap < bp ? -1 : 1;
        }
    }
    return aParts.length - bParts.length;
}

export function naturalSort<T>(items: T[], key: (item: T) => string): T[] {
    return [...items].sort((a, b) => naturalCompare(key(a), key(b)));
}
