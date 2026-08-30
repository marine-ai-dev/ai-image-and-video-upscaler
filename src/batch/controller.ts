/**
 * Batch orchestration: scanning input, planning each file, running them one at
 * a time through the existing worker pipeline, and writing the results.
 *
 * Processing is deliberately sequential. Every file competes for the same
 * GPUDevice and the same WebSR instance cache, so running two at once would
 * multiply peak VRAM without making anything faster.
 */

import {
    DeviceCaps,
    Dimensions,
    FALLBACK_DEVICE_CAPS,
    MAX_PASSES,
    SafetyReport,
    UpscaleSettings,
    defaultSettings,
    dimensionsAfterPasses,
    evaluateSafety,
    resolveFinalDimensions,
    resolvePasses
} from '../lib/upscale-math';

import {
    MediaKind,
    baseNameOf,
    buildOutputName,
    classifyFile,
    extensionForMime,
    isHiddenFile,
    naturalCompare,
    outputMimeForImage,
    uniqueName
} from '../lib/media-files';

import { PdfImageInput, PdfQuality, buildImagePdf, defaultPdfName } from '../lib/pdf-export';
import { Msg, msg } from '../lib/i18n';
import { AppError, toMsg } from '../lib/app-error';
import { CancelledError, JobProgress, WorkerBridge } from './worker-bridge';

export type ItemStatus = 'waiting' | 'processing' | 'complete' | 'failed' | 'skipped' | 'cancelled';

export interface BatchItem {
    id: string;
    name: string;
    /** Path relative to the picked folder, for display in recursive scans. */
    path: string;
    kind: Exclude<MediaKind, 'unsupported'>;
    handle: FileSystemFileHandle;
    source: Dimensions;
    /** null means "use the global batch settings". */
    override: UpscaleSettings | null;
    status: ItemStatus;
    error?: Msg;
    outputName?: string;
    passProgress?: JobProgress;
    result?: Dimensions;
}

export interface SkippedFile {
    name: string;
    reason: Msg;
}

export interface NetworkChoice {
    /** WebSR network name, e.g. "anime4k/cnn-2x-m". */
    name: string;
    /** Cache key for the weights JSON, e.g. "medium-rl". */
    weightsKey: string;
    weights: any;
    /** 'small' | 'medium' | 'large', used for memory estimates. */
    size: string;
}

export interface BatchOptions {
    createPdf: boolean;
    pdfQuality: PdfQuality;
    pdfName: string;
}

export interface BatchSummary {
    total: number;
    successful: number;
    failed: number;
    cancelled: number;
    pdfName?: string;
    pdfNotes: Msg[];
    outputLocation: Msg;
}

export interface ControllerCallbacks {
    onChange: () => void;
    onLog: (message: Msg) => void;
}

interface ProcessedImage {
    name: string;
    width: number;
    height: number;
    mime: string;
    /** Kept in memory only when there is no output directory to re-read from. */
    bytes?: Uint8Array;
    fileHandle?: FileSystemFileHandle;
}

export class BatchController {
    items: BatchItem[] = [];
    skipped: SkippedFile[] = [];
    global: UpscaleSettings = defaultSettings();
    options: BatchOptions = { createPdf: false, pdfQuality: 'maximum', pdfName: '' };
    caps: DeviceCaps = FALLBACK_DEVICE_CAPS;
    /** Measured GPU bytes per input pixel, keyed by WebSR network name. */
    bytesPerInputPixel = new Map<string, number>();
    /** Working-memory ceiling for a single file. */
    memoryBudgetBytes: number | undefined;

    running = false;
    cancelling = false;
    currentIndex = -1;
    summary: BatchSummary | null = null;
    batchName = 'batch';

    /** Directory results are written to; null falls back to browser downloads. */
    outputDirectory: FileSystemDirectoryHandle | null = null;
    outputDirectoryLabel = '';

    private usedNames = new Set<string>();
    private processedImages: ProcessedImage[] = [];
    private nextId = 0;

    constructor(
        private bridge: WorkerBridge,
        private network: () => NetworkChoice,
        private callbacks: ControllerCallbacks
    ) { }

    //=================== Input scanning ===========================

    reset(): void {
        this.items = [];
        this.skipped = [];
        this.summary = null;
        this.currentIndex = -1;
        this.usedNames = new Set();
        this.processedImages = [];
        this.outputDirectory = null;
        this.outputDirectoryLabel = '';
        // The PDF name belongs to a specific batch; quality and the checkbox are
        // user preferences and are deliberately kept.
        this.options = { ...this.options, pdfName: '' };
        this.callbacks.onChange();
    }

    /** Add explicitly picked files (single or multi-select). */
    async addFiles(handles: FileSystemFileHandle[]): Promise<void> {
        for (const handle of handles) {
            await this.addHandle(handle, handle.name);
        }
        this.sortItems();
        this.callbacks.onChange();
    }

    /**
     * Scan a picked directory. Unsupported and hidden entries are recorded and
     * skipped rather than failing the scan.
     */
    async addDirectory(directory: FileSystemDirectoryHandle, includeSubfolders: boolean): Promise<void> {
        this.batchName = directory.name || 'batch';
        await this.scanDirectory(directory, includeSubfolders, '');
        this.sortItems();
        this.callbacks.onChange();
    }

    private async scanDirectory(
        directory: FileSystemDirectoryHandle,
        recursive: boolean,
        prefix: string
    ): Promise<void> {
        for await (const entry of (directory as any).values()) {
            if (entry.kind === 'directory') {
                if (recursive && !isHiddenFile(entry.name)) {
                    await this.scanDirectory(entry, true, `${prefix}${entry.name}/`);
                } else if (!recursive) {
                    this.skipped.push({ name: `${prefix}${entry.name}/`, reason: msg('skip.subfolder') });
                }
                continue;
            }

            if (isHiddenFile(entry.name)) {
                this.skipped.push({ name: `${prefix}${entry.name}`, reason: msg('skip.hidden') });
                continue;
            }

            // Never treat our own previous output as new input.
            if (prefix.startsWith('upscaled/')) continue;

            await this.addHandle(entry as FileSystemFileHandle, `${prefix}${entry.name}`);
        }
    }

    private async addHandle(handle: FileSystemFileHandle, path: string): Promise<void> {
        const kind = classifyFile(handle.name);
        if (kind === 'unsupported') {
            this.skipped.push({ name: path, reason: msg('skip.unsupported') });
            return;
        }

        try {
            const file = await handle.getFile();
            const source = kind === 'image'
                ? await readImageDimensions(file)
                : await readVideoDimensions(file);

            this.items.push({
                id: `item-${this.nextId++}`,
                name: handle.name,
                path,
                kind,
                handle,
                source,
                override: null,
                status: 'waiting'
            });
        } catch (error: any) {
            this.skipped.push({ name: path, reason: msg('skip.unreadable', { reason: error?.message || String(error) }) });
        }
    }

    private sortItems(): void {
        this.items.sort((a, b) => naturalCompare(a.path, b.path));
    }

    removeItem(id: string): void {
        this.items = this.items.filter((item) => item.id !== id);
        this.callbacks.onChange();
    }

    //=================== Planning ===========================

    settingsFor(item: BatchItem): UpscaleSettings {
        return item.override || this.global;
    }

    passesFor(item: BatchItem): number {
        return resolvePasses(item.source, this.settingsFor(item), MAX_PASSES);
    }

    expectedFor(item: BatchItem): Dimensions {
        return resolveFinalDimensions(item.source, this.settingsFor(item), MAX_PASSES);
    }

    safetyFor(item: BatchItem): SafetyReport {
        const choice = this.network();
        return evaluateSafety({
            source: item.source,
            passes: this.passesFor(item),
            networkSize: choice.size,
            caps: this.caps,
            bytesPerInputPixel: this.bytesPerInputPixel.get(choice.name),
            memoryBudgetBytes: this.memoryBudgetBytes,
            pngOutput: item.kind === 'image' && outputMimeForImage(item.name) === 'image/png'
        });
    }

    /** Worst safety level across the queue, for the pre-flight banner. */
    batchSafety(): { level: 'ok' | 'warn' | 'block'; reasons: { name: string; reason: Msg }[] } {
        const reasons: { name: string; reason: Msg }[] = [];
        let level: 'ok' | 'warn' | 'block' = 'ok';

        for (const item of this.items) {
            const report = this.safetyFor(item);
            if (report.level === 'block') {
                level = 'block';
                reasons.push({ name: item.name, reason: report.reasons[0] });
            } else if (report.level === 'warn' && level !== 'block') {
                level = 'warn';
                reasons.push({ name: item.name, reason: report.reasons[0] });
            }
        }

        return { level, reasons: reasons.slice(0, 4) };
    }

    counts(): { images: number; videos: number; unsupported: number } {
        return {
            images: this.items.filter((i) => i.kind === 'image').length,
            videos: this.items.filter((i) => i.kind === 'video').length,
            unsupported: this.skipped.length
        };
    }

    //=================== Output location ===========================

    async useDirectory(directory: FileSystemDirectoryHandle, label: string): Promise<void> {
        this.outputDirectory = directory;
        this.outputDirectoryLabel = label;
        this.callbacks.onChange();
    }

    /** `<source folder>/upscaled/`, created on demand. */
    async useUpscaledSubfolder(parent: FileSystemDirectoryHandle): Promise<void> {
        const output = await parent.getDirectoryHandle('upscaled', { create: true });
        await this.useDirectory(output, `${parent.name}/upscaled/`);
    }

    //=================== Processing ===========================

    async run(): Promise<BatchSummary> {
        if (this.running) throw new AppError('error.batch_running');

        this.running = true;
        this.cancelling = false;
        // A previous run may have been cancelled; clear that before starting.
        this.bridge.resetCancel();
        this.summary = null;
        this.processedImages = [];
        this.usedNames = new Set();

        for (const item of this.items) {
            item.status = 'waiting';
            item.error = undefined;
            item.passProgress = undefined;
            item.result = undefined;
            item.outputName = undefined;
        }
        this.callbacks.onChange();

        let successful = 0;
        let failed = 0;
        let cancelled = 0;

        const choice = this.network();
        this.bridge.registerWeights(choice.weightsKey, choice.weights);

        for (let index = 0; index < this.items.length; index++) {
            const item = this.items[index];

            if (this.cancelling) {
                item.status = 'cancelled';
                cancelled++;
                continue;
            }

            this.currentIndex = index;
            item.status = 'processing';
            this.callbacks.onChange();

            try {
                await this.processItem(item, choice);
                item.status = 'complete';
                successful++;
            } catch (error: any) {
                if (error instanceof CancelledError || this.cancelling) {
                    item.status = 'cancelled';
                    cancelled++;
                } else {
                    item.status = 'failed';
                    item.error = toMsg(error);
                    failed++;
                    this.callbacks.onLog(msg('log.failed', { path: item.path, reason: error?.message || String(error) }));
                    console.error('[batch] failed', item.path, error);
                }
            }

            this.callbacks.onChange();
        }

        this.currentIndex = -1;

        const summary: BatchSummary = {
            total: this.items.length,
            successful,
            failed,
            cancelled,
            pdfNotes: [],
            outputLocation: this.outputDirectoryLabel ? msg('error.raw', { reason: this.outputDirectoryLabel }) : msg('batch.downloads')
        };

        if (this.options.createPdf && !this.cancelling && this.processedImages.length > 0) {
            try {
                const pdf = await this.buildPdf();
                summary.pdfName = pdf.name;
                summary.pdfNotes = pdf.notes;
            } catch (error: any) {
                const reason = error?.message || String(error);
                summary.pdfNotes = [msg('log.pdf_failed', { reason })];
                this.callbacks.onLog(msg('log.pdf_failed', { reason }));
                console.error('[batch] pdf failed', error);
            }
        }

        this.processedImages = [];
        this.summary = summary;
        this.running = false;
        this.cancelling = false;
        this.bridge.releaseCache();
        this.callbacks.onChange();

        return summary;
    }

    cancel(): void {
        if (!this.running) return;
        this.cancelling = true;
        this.bridge.cancel();
        this.callbacks.onLog(msg('log.cancelling'));
        this.callbacks.onChange();
    }

    private async processItem(item: BatchItem, choice: NetworkChoice): Promise<void> {
        const passes = this.passesFor(item);
        const safety = this.safetyFor(item);

        if (safety.level === 'block') {
            throw new AppError(safety.reasons[0]?.key || 'error.gpu_limits', safety.reasons[0]?.params);
        }

        const jobId = this.bridge.nextJobId(item.id);
        const onProgress = (progress: JobProgress) => {
            item.passProgress = progress;
            this.callbacks.onChange();
        };

        this.callbacks.onLog(msg('log.item', {
            path: item.path,
            kind: item.kind,
            source: `${item.source.width}x${item.source.height}`,
            target: `${safety.finalDimensions.width}x${safety.finalDimensions.height}`,
            passes
        }));

        if (item.kind === 'image') {
            await this.processImageItem(item, choice, passes, jobId, onProgress);
        } else {
            await this.processVideoItem(item, choice, passes, jobId, onProgress);
        }
    }

    private async processImageItem(
        item: BatchItem,
        choice: NetworkChoice,
        passes: number,
        jobId: string,
        onProgress: (progress: JobProgress) => void
    ): Promise<void> {
        const file = await item.handle.getFile();
        const mimeType = outputMimeForImage(item.name);
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

        // The bitmap is transferred to the worker, which closes it when done.
        const result = await this.bridge.runImageJob(
            jobId,
            bitmap,
            { name: choice.name, weightsKey: choice.weightsKey, passes, mimeType, preserveAlpha: mimeType === 'image/png' },
            onProgress
        );

        if (!result.data) throw new AppError('error.no_image_data');

        const dimensions = { width: result.width, height: result.height };
        assertExpectedDimensions(item, dimensions, passes);
        const outputName = uniqueName(
            buildOutputName(item.name, dimensions, extensionForMime(result.mimeType)),
            this.usedNames
        );

        const bytes = new Uint8Array(result.data);
        const handle = await this.writeOutput(outputName, bytes, result.mimeType);

        item.result = dimensions;
        item.outputName = outputName;

        if (this.options.createPdf) {
            this.processedImages.push({
                name: outputName,
                width: result.width,
                height: result.height,
                mime: result.mimeType,
                // Re-read from disk at PDF time when we can, to keep peak memory down.
                bytes: handle ? undefined : bytes,
                fileHandle: handle || undefined
            });
        }

        this.callbacks.onLog(msg('log.saved', { name: outputName, size: `${dimensions.width}x${dimensions.height}` }));
    }

    private async processVideoItem(
        item: BatchItem,
        choice: NetworkChoice,
        passes: number,
        jobId: string,
        onProgress: (progress: JobProgress) => void
    ): Promise<void> {
        const expected = this.expectedFor(item);
        const outputName = uniqueName(buildOutputName(item.name, expected, 'mp4'), this.usedNames);

        // Streaming straight into the output file avoids buffering the whole
        // encoded video in memory.
        let outputHandle: FileSystemFileHandle | undefined;
        if (this.outputDirectory) {
            outputHandle = await this.outputDirectory.getFileHandle(outputName, { create: true });
        }

        const result = await this.bridge.runVideoJob(
            jobId,
            await item.handle.getFile(),
            outputHandle,
            { name: choice.name, weightsKey: choice.weightsKey, passes },
            onProgress
        );

        assertExpectedDimensions(item, { width: result.width, height: result.height }, passes);

        if (!outputHandle) {
            if (!result.data) throw new AppError('error.no_video_data');
            await this.writeOutput(outputName, new Uint8Array(result.data), 'video/mp4');
        }

        item.result = { width: result.width, height: result.height };
        item.outputName = outputName;
        this.callbacks.onLog(msg('log.saved', { name: outputName, size: `${result.width}x${result.height}` }));
    }

    /**
     * Write to the chosen output directory, or fall back to a browser download.
     * Never touches the source file.
     */
    private async writeOutput(
        name: string,
        bytes: Uint8Array,
        mimeType: string
    ): Promise<FileSystemFileHandle | null> {
        if (this.outputDirectory) {
            const handle = await this.outputDirectory.getFileHandle(name, { create: true });
            const writable = await handle.createWritable();
            await writable.write(bytes as any);
            await writable.close();
            return handle;
        }

        const blob = new Blob([bytes as any], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        return null;
    }

    //=================== PDF ===========================

    private async buildPdf(): Promise<{ name: string; notes: Msg[] }> {
        // Queue order is already natural-sorted; keep it. Bytes are pulled in
        // one image at a time, straight off disk where possible.
        const inputs: PdfImageInput[] = this.processedImages.map((image) => ({
            name: image.name,
            mime: image.mime,
            width: image.width,
            height: image.height,
            load: async () => image.bytes
                ? image.bytes
                : new Uint8Array(await (await image.fileHandle!.getFile()).arrayBuffer())
        }));

        const result = await buildImagePdf(inputs, { quality: this.options.pdfQuality });
        const name = uniqueName(
            this.options.pdfName?.trim() || defaultPdfName(this.batchName),
            this.usedNames
        );

        await this.writeOutput(name, result.bytes, 'application/pdf');
        this.callbacks.onLog(msg('log.pdf', { name, pages: result.pageCount }));

        return { name, notes: result.notes };
    }
}

/**
 * The produced file must actually have the resolution we promised. A mismatch
 * means the pipeline did something other than N native passes, so it is
 * reported as a failure rather than silently accepted.
 */
function assertExpectedDimensions(item: BatchItem, actual: Dimensions, passes: number): void {
    const expected = dimensionsAfterPasses(item.source, passes);
    if (actual.width === expected.width && actual.height === expected.height) return;

    throw new AppError('error.size_mismatch', {
        expected: `${expected.width}x${expected.height}`,
        actual: `${actual.width}x${actual.height}`,
        passes
    });
}

//=================== Media probing ===========================

async function readImageDimensions(file: File): Promise<Dimensions> {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
}

function readVideoDimensions(file: File): Promise<Dimensions> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);

        const cleanup = () => {
            URL.revokeObjectURL(url);
            video.removeAttribute('src');
        };

        video.onloadedmetadata = () => {
            const dimensions = { width: video.videoWidth, height: video.videoHeight };
            cleanup();
            if (!dimensions.width || !dimensions.height) {
                reject(new AppError('error.read_dimensions'));
                return;
            }
            resolve(dimensions);
        };

        video.onerror = () => {
            cleanup();
            reject(new AppError('error.read_metadata'));
        };

        video.preload = 'metadata';
        video.src = url;
    });
}

export { baseNameOf };
