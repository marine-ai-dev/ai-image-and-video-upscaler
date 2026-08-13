/**
 * Browser test harness for the upscale pipeline.
 *
 * Native file/directory pickers cannot be driven programmatically, so this page
 * feeds the *real* BatchController and the *real* worker (real WebGPU, real
 * WebSR networks, real encoders) through picker-shaped stand-ins, and checks
 * the results. Nothing here is part of the shipped app: it is only built when
 * INCLUDE_TEST_HARNESS=1 is set for the webpack build.
 *
 * Run with:  INCLUDE_TEST_HARNESS=1 npm run serve   ->  /test-harness.html
 */

import { BatchController } from '../batch/controller';
import { WorkerBridge } from '../batch/worker-bridge';
import { BufferSource, Input, MP4, QTFF } from 'mediabunny';
import { PDFDocument } from 'pdf-lib';
import { buildImagePdf } from '../lib/pdf-export';
import { planForTarget, resolvePasses } from '../lib/upscale-math';
import { naturalSort } from '../lib/media-files';

const worker = new Worker(new URL('../worker.ts', import.meta.url));

const weights: Record<string, any> = {
    'medium-rl': require('../weights/cnn-2x-m-rl.json'),
    'small-rl': require('../weights/cnn-2x-s-rl.json')
};

const NETWORK = { name: 'anime4k/cnn-2x-m', weightsKey: 'medium-rl', weights: weights['medium-rl'], size: 'medium' };

let bridge: WorkerBridge;
let output: HTMLElement;
let passed = 0;
let failed = 0;

//=================== Real directories, without a picker ===========================

/**
 * The Origin Private File System gives real FileSystemDirectoryHandle /
 * FileSystemFileHandle objects - the same types the pickers return, including
 * being structured-cloneable into the worker. Only the picker UI is skipped.
 */
let opfsRoot: FileSystemDirectoryHandle;
let runCounter = 0;

async function freshDirectory(label: string): Promise<FileSystemDirectoryHandle> {
    const name = `test-${label}-${++runCounter}`;
    try {
        await (opfsRoot as any).removeEntry(name, { recursive: true });
    } catch { /* first run */ }
    return opfsRoot.getDirectoryHandle(name, { create: true });
}

/** Copy a served test file into a real directory and return its handle. */
async function writeInto(directory: FileSystemDirectoryHandle, file: File): Promise<FileSystemFileHandle> {
    const handle = await directory.getFileHandle(file.name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();
    return handle;
}

async function listFiles(directory: FileSystemDirectoryHandle): Promise<string[]> {
    const names: string[] = [];
    for await (const entry of (directory as any).values()) {
        if (entry.kind === 'file') names.push(entry.name);
    }
    return names;
}

async function readFileBytes(directory: FileSystemDirectoryHandle, name: string): Promise<Uint8Array> {
    const handle = await directory.getFileHandle(name);
    return new Uint8Array(await (await handle.getFile()).arrayBuffer());
}

//=================== Assertions / reporting ===========================

function report(name: string, ok: boolean, detail: string): void {
    if (ok) passed++; else failed++;
    const row = document.createElement('div');
    row.className = `row ${ok ? 'pass' : 'fail'}`;
    row.textContent = `${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`;
    output.appendChild(row);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
}

function check(name: string, condition: boolean, detail: string): void {
    report(name, condition, detail);
}

function note(text: string): void {
    const row = document.createElement('div');
    row.className = 'row note';
    row.textContent = text;
    output.appendChild(row);
}

//=================== Helpers ===========================

async function fetchFile(name: string, type: string): Promise<File> {
    const response = await fetch(`test-media/${name}`);
    const blob = await response.blob();
    return new File([blob], name, { type });
}

async function dimensionsOf(bytes: Uint8Array): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(new Blob([bytes as any]));
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
}

function makeController(outputDir: FileSystemDirectoryHandle): BatchController {
    const controller = new BatchController(bridge, () => NETWORK, {
        onChange: () => { },
        onLog: (message) => console.log('[batch]', message)
    });
    controller.outputDirectory = outputDir;
    controller.outputDirectoryLabel = `${outputDir.name}/`;
    return controller;
}

//=================== Tests ===========================

/** Test 1 & 2: single image, one pass then multiple passes. */
async function testSinglePasses(): Promise<void> {
    const file = await fetchFile('page_1.png', 'image/png');

    for (const passes of [1, 2]) {
        const bitmap = await createImageBitmap(file);
        const source = { width: bitmap.width, height: bitmap.height };
        const result = await bridge.runImageJob(
            bridge.nextJobId('single'),
            bitmap,
            { ...NETWORK, passes, mimeType: 'image/png', preserveAlpha: true }
        );
        const expected = { width: source.width * 2 ** passes, height: source.height * 2 ** passes };
        const actual = await dimensionsOf(new Uint8Array(result.data!));

        check(
            `Test ${passes === 1 ? '1' : '2'} — single image, ${passes} pass(es)`,
            actual.width === expected.width && actual.height === expected.height,
            `${source.width}x${source.height} -> ${actual.width}x${actual.height} (expected ${expected.width}x${expected.height})`
        );
    }
}

/** Test 3: target resolution picks the right pass count from the real 2x factor. */
async function testTargetResolution(): Promise<void> {
    const file = await fetchFile('page_1.png', 'image/png');
    const probe = await createImageBitmap(file);
    const source = { width: probe.width, height: probe.height };
    probe.close();

    const target = 1024;
    const plan = planForTarget(source, target);
    const passes = resolvePasses(source, { mode: 'target', passes: 1, targetLongEdge: target });

    const bitmap = await createImageBitmap(file);
    const result = await bridge.runImageJob(
        bridge.nextJobId('target'),
        bitmap,
        { ...NETWORK, passes, mimeType: 'image/png', preserveAlpha: true }
    );
    const actual = await dimensionsOf(new Uint8Array(result.data!));

    check(
        'Test 3 — target resolution',
        passes === 2 && actual.width === plan.result.width && actual.height === plan.result.height,
        `target ${target}px -> ${passes} passes -> ${actual.width}x${actual.height}`
    );
}

/** Test 4: rectangular source keeps its aspect ratio. */
async function testNonSquare(): Promise<void> {
    const file = await fetchFile('page_2.png', 'image/png');
    const bitmap = await createImageBitmap(file);
    const source = { width: bitmap.width, height: bitmap.height };

    const result = await bridge.runImageJob(
        bridge.nextJobId('rect'),
        bitmap,
        { ...NETWORK, passes: 2, mimeType: 'image/png', preserveAlpha: true }
    );
    const actual = await dimensionsOf(new Uint8Array(result.data!));

    const sourceRatio = source.width / source.height;
    const actualRatio = actual.width / actual.height;

    check(
        'Test 4 — non-square image keeps aspect ratio',
        actual.width === source.width * 4 && actual.height === source.height * 4 && sourceRatio === actualRatio,
        `${source.width}x${source.height} -> ${actual.width}x${actual.height} (ratio ${sourceRatio.toFixed(4)} = ${actualRatio.toFixed(4)})`
    );
}

/** Tests 5 & 6: multi-file batch, queue, filenames, and a per-file override. */
async function testBatchAndOverrides(): Promise<void> {
    const sourceDir = await freshDirectory('batch-src');
    const dir = await freshDirectory('batch-out');
    const controller = makeController(dir);
    controller.global = { mode: 'passes', passes: 1, targetLongEdge: 4096 };

    const files = await Promise.all([
        fetchFile('page_10.png', 'image/png'),
        fetchFile('page_2.png', 'image/png'),
        fetchFile('page_1.png', 'image/png')
    ]);
    const handles = [];
    for (const file of files) handles.push(await writeInto(sourceDir, file));
    await controller.addFiles(handles);

    check(
        'Test 5a — queue built and naturally ordered',
        controller.items.length === 3 && controller.items.map((i) => i.name).join(',') === 'page_1.png,page_2.png,page_10.png',
        controller.items.map((i) => i.name).join(', ')
    );

    // Test 6: one file gets a different pass count from the global default.
    const overridden = controller.items.find((i) => i.name === 'page_2.png')!;
    overridden.override = { mode: 'passes', passes: 2, targetLongEdge: 4096 };

    const summary = await controller.run();

    check(
        'Test 5b — all files processed',
        summary.successful === 3 && summary.failed === 0,
        `${summary.successful} successful, ${summary.failed} failed`
    );

    const names = await listFiles(dir);
    check(
        'Test 5c — output filenames describe the real resolution',
        names.includes('page_1_upscaled_512x512.png') && names.includes('page_10_upscaled_512x512.png'),
        names.join(', ')
    );

    const overriddenOutput = names.find((n) => n.startsWith('page_2_'))!;
    const overriddenDims = await dimensionsOf(await readFileBytes(dir, overriddenOutput));
    check(
        'Test 6 — per-file override applied (2 passes vs global 1)',
        overriddenDims.width === 1024 && overriddenDims.height === 768,
        `page_2.png 256x192 -> ${overriddenDims.width}x${overriddenDims.height} (global would be 512x384)`
    );
}

/** Test 7: folder scan ignores unsupported, hidden and sub-folder entries. */
async function testFolderScan(): Promise<void> {
    const sourceDir = await freshDirectory('photos');

    const files = await Promise.all([
        fetchFile('page_1.png', 'image/png'),
        fetchFile('notes.txt', 'text/plain'),
        fetchFile('data.json', 'application/json'),
        fetchFile('.DS_Store', 'application/octet-stream'),
        fetchFile('wide.jpg', 'image/jpeg')
    ]);
    for (const file of files) await writeInto(sourceDir, file);

    const nested = await sourceDir.getDirectoryHandle('nested', { create: true });
    await writeInto(nested, await fetchFile('page_3.png', 'image/png'));

    // Without recursion
    const flat = makeController(await freshDirectory('scan-out'));
    await flat.addDirectory(sourceDir, false);

    check(
        'Test 7a — folder scan keeps only supported files',
        flat.items.length === 2 && flat.items.every((i) => i.kind === 'image'),
        `kept ${flat.items.map((i) => i.name).join(', ')}`
    );
    check(
        'Test 7b — unsupported/hidden files reported, not crashed on',
        flat.skipped.length === 4 &&
        flat.skipped.some((s) => s.name.includes('notes.txt')) &&
        flat.skipped.some((s) => s.name.includes('.DS_Store')) &&
        flat.skipped.some((s) => s.reason.includes('subfolder')),
        flat.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')
    );

    // With recursion explicitly enabled
    const deep = makeController(await freshDirectory('scan-out-deep'));
    await deep.addDirectory(sourceDir, true);
    check(
        'Test 7c — subfolders only scanned when explicitly enabled',
        deep.items.length === 3 && deep.items.some((i) => i.path === 'nested/page_3.png'),
        deep.items.map((i) => i.path).join(', ')
    );
}

/** Tests 8 & 10: mixed image + video batch, and PDF excluding the video. */
async function testMixedBatchAndPdf(): Promise<void> {
    const sourceDir = await freshDirectory('mixed-src');
    const dir = await freshDirectory('mixed-out');
    const controller = makeController(dir);
    controller.global = { mode: 'passes', passes: 1, targetLongEdge: 4096 };
    controller.options = { createPdf: true, pdfQuality: 'maximum', pdfName: 'halloween_book.pdf' };
    controller.batchName = 'halloween_book';

    const files = await Promise.all([
        fetchFile('page_1.png', 'image/png'),
        fetchFile('page_2.png', 'image/png'),
        fetchFile('page_10.png', 'image/png'),
        fetchFile('clip.mp4', 'video/mp4')
    ]);
    const handles = [];
    for (const file of files) handles.push(await writeInto(sourceDir, file));
    await controller.addFiles(handles);

    const counts = controller.counts();
    check(
        'Test 8a — mixed batch routed by media type',
        counts.images === 3 && counts.videos === 1,
        `${counts.images} images, ${counts.videos} videos`
    );

    const summary = await controller.run();

    const videoItem = controller.items.find((i) => i.kind === 'video')!;
    check(
        'Test 8b — video processed through the video pipeline',
        videoItem.status === 'complete' && videoItem.result?.width === 320 && videoItem.result?.height === 240,
        `${videoItem.name}: ${videoItem.status}, 160x120 -> ${videoItem.result?.width}x${videoItem.result?.height}` +
        (videoItem.error ? ` — error: ${videoItem.error}` : '')
    );

    check(
        'Test 9a — PDF created from the processed images',
        !!summary.pdfName,
        summary.pdfName || 'no PDF produced'
    );

    const pdfBytes = await readFileBytes(dir, summary.pdfName!).catch(() => null);
    const header = pdfBytes ? new TextDecoder().decode(pdfBytes.slice(0, 5)) : '';
    const parsed = pdfBytes ? await readPdf(pdfBytes) : { pages: 0, sizes: [] };

    check(
        'Test 9b — PDF is valid and has one page per image',
        header === '%PDF-' && parsed.pages === 3,
        `header "${header}", ${parsed.pages} pages ` +
        `(${parsed.sizes.map((s) => `${Math.round(s.width)}x${Math.round(s.height)}`).join(', ')}), ` +
        `${pdfBytes ? (pdfBytes.length / 1024).toFixed(0) : 0} KiB`
    );

    check(
        'Test 10 — video excluded from the PDF, but still upscaled',
        parsed.pages === 3 && videoItem.status === 'complete' && !!videoItem.outputName?.endsWith('.mp4'),
        `${parsed.pages} PDF pages for 3 images; video output ${videoItem.outputName}`
    );

    // Order check, read back from the PDF itself. page_2 is 256x192 while
    // page_1 and page_10 are square, so the page-size sequence distinguishes
    // natural order (1, 2, 10) from lexical order (1, 10, 2).
    const sizeSequence = parsed.sizes.map((s) => `${Math.round(s.width)}x${Math.round(s.height)}`).join(',');
    const imageOutputs = (await listFiles(dir)).filter((n) => n.endsWith('.png'));
    check(
        'Test 9c — PDF page order follows natural filename order',
        sizeSequence === '512x512,512x384,512x512',
        `pages: ${sizeSequence} (lexical order would be 512x512,512x512,512x384); ` +
        `written: ${naturalSort(imageOutputs, (n) => n).join(', ')}`
    );
}

/** Test 9d: PDF page geometry must match image aspect ratio (no stretching). */
async function testPdfAspect(): Promise<void> {
    const wide = await fetchFile('wide.jpg', 'image/jpeg');
    const bytes = new Uint8Array(await wide.arrayBuffer());
    const bitmap = await createImageBitmap(wide);

    const result = await buildImagePdf([
        { name: 'wide.jpg', load: async () => bytes, mime: 'image/jpeg', width: bitmap.width, height: bitmap.height }
    ], { quality: 'maximum' });

    const parsed = await readPdf(result.bytes);
    const pageWidth = parsed.sizes[0]?.width || 0;
    const pageHeight = parsed.sizes[0]?.height || 0;

    const imageRatio = bitmap.width / bitmap.height;
    const pageRatio = pageWidth / pageHeight;

    check(
        'Test 9d — PDF page matches image aspect ratio (no distortion)',
        Math.abs(imageRatio - pageRatio) < 0.001,
        `image ${bitmap.width}x${bitmap.height} (${imageRatio.toFixed(3)}), page ${pageWidth}x${pageHeight} (${pageRatio.toFixed(3)})`
    );

    // JPEG bytes should be embedded verbatim at Maximum quality.
    check(
        'Test 9e — JPEG embedded without recompression',
        result.bytes.length > bytes.length * 0.9 && result.notes.length === 0,
        `source ${(bytes.length / 1024).toFixed(0)} KiB, pdf ${(result.bytes.length / 1024).toFixed(0)} KiB, notes: ${result.notes.length}`
    );

    bitmap.close();
}

/** Test 11: one bad file must not destroy the batch. */
async function testFailureIsolation(): Promise<void> {
    const sourceDir = await freshDirectory('fail-src');
    const controller = makeController(await freshDirectory('fail-out'));
    controller.global = { mode: 'passes', passes: 1, targetLongEdge: 4096 };

    const good1 = await writeInto(sourceDir, await fetchFile('page_1.png', 'image/png'));
    const good2 = await writeInto(sourceDir, await fetchFile('page_3.png', 'image/png'));

    await controller.addFiles([good1, good2]);

    // A corrupt file that decodes at scan time is impossible, so inject an item
    // whose handle fails when the processor reads it.
    controller.items.splice(1, 0, {
        id: 'broken',
        name: 'broken.png',
        path: 'broken.png',
        kind: 'image',
        handle: { name: 'broken.png', getFile: async () => { throw new Error('simulated read failure'); } } as any,
        source: { width: 256, height: 256 },
        override: null,
        status: 'waiting'
    });

    const summary = await controller.run();

    check(
        'Test 11 — failure isolation',
        summary.successful === 2 && summary.failed === 1 &&
        controller.items.find((i) => i.id === 'broken')!.status === 'failed',
        `${summary.total} files: ${summary.successful} successful, ${summary.failed} failed ` +
        `(${controller.items.find((i) => i.id === 'broken')!.error})`
    );
}

/** Test 12: corrupt input during scanning is reported, not thrown. */
async function testCorruptScan(): Promise<void> {
    const sourceDir = await freshDirectory('corrupt-src');
    const controller = makeController(await freshDirectory('corrupt-out'));
    await controller.addFiles([await writeInto(sourceDir, await fetchFile('corrupt.png', 'image/png'))]);

    check(
        'Test 7d — undecodable image is skipped with a reason',
        controller.items.length === 0 && controller.skipped.length === 1,
        controller.skipped.map((s) => `${s.name}: ${s.reason}`).join('; ')
    );
}

/** Test 8c: multi-pass video through the real encoder. */
async function testMultiPassVideo(): Promise<void> {
    const sourceDir = await freshDirectory('video-src');
    const dir = await freshDirectory('video-out');
    const controller = makeController(dir);
    controller.global = { mode: 'passes', passes: 2, targetLongEdge: 4096 };

    const handle = await writeInto(sourceDir, await fetchFile('clip.mp4', 'video/mp4'));
    await controller.addFiles([handle]);

    const summary = await controller.run();
    const item = controller.items[0];

    check(
        'Test 8c — multi-pass video (2 passes)',
        summary.successful === 1 && item.result?.width === 640 && item.result?.height === 480,
        `clip.mp4 160x120 -> ${item.result?.width}x${item.result?.height}, output ${item.outputName}` +
        (item.error ? ` — error: ${item.error}` : '')
    );
}

/** Wait for a specific non-job message from the worker. */
function waitForWorker(cmd: string, timeoutMs = 120000): Promise<any> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for "${cmd}"`)), timeoutMs);
        previewWaiters.push({ cmd, resolve, reject, timer });
    });
}

const previewWaiters: { cmd: string; resolve: (v: any) => void; reject: (e: any) => void; timer: any }[] = [];

/**
 * Test 12 (regression): the original single-file preview path in the worker -
 * init -> network -> processImage / process - must still behave as before.
 */
async function testPreviewPathRegression(): Promise<void> {
    const file = await fetchFile('page_1.png', 'image/png');
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const upscaledCanvas = document.createElement('canvas');
    const originalCanvas = document.createElement('canvas');
    upscaledCanvas.width = bitmap.width * 2;
    upscaledCanvas.height = bitmap.height * 2;
    originalCanvas.width = bitmap.width * 2;
    originalCanvas.height = bitmap.height * 2;

    const upscaled = upscaledCanvas.transferControlToOffscreen();
    const original = originalCanvas.transferControlToOffscreen();

    worker.postMessage({
        cmd: 'init',
        data: {
            bitmap,
            upscaled,
            original,
            resolution: { width: bitmap.width, height: bitmap.height },
            preserveAlpha: true
        }
    }, [upscaled, original]);

    worker.postMessage({
        cmd: 'network',
        data: { name: NETWORK.name, bitmap, weights: NETWORK.weights, preserveAlpha: true }
    });

    // Old path: no options at all -> single pass, exactly as before this change.
    const singleDone = waitForWorker('finishedImage');
    worker.postMessage({ cmd: 'processImage', data: { bitmap, mimeType: 'image/png' } });
    const single = await singleDone;
    const singleDims = await dimensionsOf(new Uint8Array(single.data));

    check(
        'Test 12a — regression: original single-pass preview path',
        singleDims.width === bitmap.width * 2 && singleDims.height === bitmap.height * 2,
        `${bitmap.width}x${bitmap.height} -> ${singleDims.width}x${singleDims.height}, mime ${single.mimeType}`
    );

    // New path through the same preview instance: 2 passes.
    const multiDone = waitForWorker('finishedImage');
    worker.postMessage({
        cmd: 'processImage',
        data: {
            bitmap,
            mimeType: 'image/png',
            options: { name: NETWORK.name, weightsKey: NETWORK.weightsKey, passes: 2 }
        }
    });
    const multi = await multiDone;
    const multiDims = await dimensionsOf(new Uint8Array(multi.data));

    check(
        'Test 12b — preview path with multiple passes',
        multiDims.width === bitmap.width * 4 && multiDims.height === bitmap.height * 4,
        `${bitmap.width}x${bitmap.height} -> ${multiDims.width}x${multiDims.height}`
    );
}

/** Test 12c (regression): the original video preview path (cmd: 'process'). */
async function testVideoPreviewRegression(): Promise<void> {
    const sourceDir = await freshDirectory('preview-video');
    const handle = await writeInto(sourceDir, await fetchFile('clip.mp4', 'video/mp4'));

    // Re-init the preview instance at the video's resolution, as the app does.
    const seed = new OffscreenCanvas(160, 120);
    const seedCtx = seed.getContext('2d')!;
    seedCtx.fillStyle = '#888';
    seedCtx.fillRect(0, 0, 160, 120);
    const seedBitmap = seed.transferToImageBitmap();

    const upscaledCanvas = document.createElement('canvas');
    const originalCanvas = document.createElement('canvas');
    upscaledCanvas.width = 320;
    upscaledCanvas.height = 240;
    originalCanvas.width = 320;
    originalCanvas.height = 240;

    const upscaled = upscaledCanvas.transferControlToOffscreen();
    const original = originalCanvas.transferControlToOffscreen();

    worker.postMessage({
        cmd: 'init',
        data: {
            bitmap: seedBitmap,
            upscaled,
            original,
            resolution: { width: 160, height: 120 }
        }
    }, [upscaled, original]);

    const done = waitForWorker('finished');
    worker.postMessage({ cmd: 'process', inputHandle: handle });
    const result = await done;

    const bytes = result.data ? new Uint8Array(result.data) : null;
    const isMp4 = !!bytes && new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp';

    check(
        'Test 12c — regression: original video preview path',
        isMp4 && bytes!.length > 1000,
        `produced ${bytes ? (bytes.length / 1024).toFixed(0) : 0} KiB MP4 (ftyp header: ${isMp4})`
    );
}

/** Test 2b: three passes, where the hardware allows it. */
async function testThreePasses(): Promise<void> {
    const file = await fetchFile('page_1.png', 'image/png');
    const bitmap = await createImageBitmap(file);
    const source = { width: bitmap.width, height: bitmap.height };

    const result = await bridge.runImageJob(
        bridge.nextJobId('three'),
        bitmap,
        { ...NETWORK, passes: 3, mimeType: 'image/png', preserveAlpha: true }
    );
    const actual = await dimensionsOf(new Uint8Array(result.data!));

    check(
        'Test 2b — single image, 3 passes',
        actual.width === source.width * 8 && actual.height === source.height * 8,
        `${source.width}x${source.height} -> ${actual.width}x${actual.height} (expected ${source.width * 8}x${source.height * 8})`
    );
}

/** Test 13: two files producing the same output name must not overwrite. */
async function testFilenameCollision(): Promise<void> {
    const srcA = await freshDirectory('collide-a');
    const srcB = await freshDirectory('collide-b');
    const out = await freshDirectory('collide-out');
    const controller = makeController(out);
    controller.global = { mode: 'passes', passes: 1, targetLongEdge: 4096 };

    // Same filename and same dimensions in two different folders.
    const file = await fetchFile('page_1.png', 'image/png');
    const a = await writeInto(srcA, file);
    const b = await writeInto(srcB, file);
    await controller.addFiles([a, b]);

    const summary = await controller.run();
    const names = (await listFiles(out)).sort();

    check(
        'Test 13 — filename collisions are resolved, not overwritten',
        summary.successful === 2 && names.length === 2 &&
        names.includes('page_1_upscaled_512x512.png') && names.includes('page_1_upscaled_512x512 (2).png'),
        names.join(', ')
    );
}

/** Test 14: cancelling a batch stops it without corrupting finished work. */
async function testCancellation(): Promise<void> {
    const src = await freshDirectory('cancel-src');
    const out = await freshDirectory('cancel-out');
    const controller = makeController(out);
    controller.global = { mode: 'passes', passes: 2, targetLongEdge: 4096 };

    const handles = [];
    for (const name of ['page_1.png', 'page_2.png', 'page_3.png', 'page_10.png']) {
        handles.push(await writeInto(src, await fetchFile(name, 'image/png')));
    }
    await controller.addFiles(handles);

    const run = controller.run();
    // Cancel almost immediately: the first file should finish, the rest should not run.
    setTimeout(() => controller.cancel(), 60);
    const summary = await run;

    const cancelled = controller.items.filter((i) => i.status === 'cancelled').length;
    const completed = controller.items.filter((i) => i.status === 'complete').length;
    const written = await listFiles(out);

    // Everything that reports "complete" must be a real, readable file.
    let allValid = true;
    for (const name of written) {
        try {
            const dims = await dimensionsOf(await readFileBytes(out, name));
            if (!dims.width || !dims.height) allValid = false;
        } catch { allValid = false; }
    }

    check(
        'Test 14a — cancellation stops the batch cleanly',
        cancelled > 0 && completed + cancelled === controller.items.length && allValid &&
        written.length === completed,
        `${completed} complete, ${cancelled} cancelled, ${written.length} files written, all readable: ${allValid}`
    );

    // Regression: a cancelled batch must not leave the worker refusing new work.
    let afterCancelOk = false;
    let afterCancelDetail = '';
    try {
        const bitmap = await createImageBitmap(await fetchFile('page_1.png', 'image/png'));
        const result = await bridge.runImageJob(
            bridge.nextJobId('after-cancel'),
            bitmap,
            { ...NETWORK, passes: 1, mimeType: 'image/png', preserveAlpha: true }
        );
        const dims = await dimensionsOf(new Uint8Array(result.data!));
        afterCancelOk = dims.width === 512 && dims.height === 512;
        afterCancelDetail = `${dims.width}x${dims.height}`;
    } catch (error: any) {
        afterCancelDetail = `threw: ${error?.message || error}`;
    }

    check(
        'Test 14b — work still runs after a cancelled batch',
        afterCancelOk,
        afterCancelDetail
    );
}

/**
 * Test 15: GPU resource lifecycle across repeated jobs, with no page reload.
 * image (2 passes) -> image (2 passes) -> batch -> image again.
 */
async function testGpuLifecycle(): Promise<void> {
    const before = await bridge.gpuStats();

    const run = async (name: string, passes: number) => {
        const bitmap = await createImageBitmap(await fetchFile(name, 'image/png'));
        const result = await bridge.runImageJob(
            bridge.nextJobId('life'),
            bitmap,
            { ...NETWORK, passes, mimeType: 'image/png', preserveAlpha: true }
        );
        return dimensionsOf(new Uint8Array(result.data!));
    };

    await run('page_1.png', 2);
    const afterFirst = await bridge.gpuStats();

    await run('page_3.png', 2);
    const afterSecond = await bridge.gpuStats();

    // A batch in between, then another single image.
    const src = await freshDirectory('life-src');
    const controller = makeController(await freshDirectory('life-out'));
    controller.global = { mode: 'passes', passes: 2, targetLongEdge: 4096 };
    const handles = [];
    for (const n of ['page_1.png', 'page_2.png', 'page_10.png']) {
        handles.push(await writeInto(src, await fetchFile(n, 'image/png')));
    }
    await controller.addFiles(handles);
    const batchSummary = await controller.run();
    const afterBatch = await bridge.gpuStats();

    const finalDims = await run('page_1.png', 2);
    const afterFinal = await bridge.gpuStats();

    // Same resolutions reused -> instance count must not grow with job count.
    const stable = afterFinal.instances <= afterSecond.instances + 1;
    const bounded = afterFinal.bytes <= 1.5 * 1024 ** 3;

    check(
        'Test 15a — repeated jobs reuse cached instances instead of accumulating',
        stable && bounded && finalDims.width === 1024,
        `instances: start ${before.instances}, after#1 ${afterFirst.instances}, after#2 ${afterSecond.instances}, ` +
        `after batch ${afterBatch.instances} (released), after#4 ${afterFinal.instances}; ` +
        `cache ${(afterFinal.bytes / 1024 ** 2).toFixed(0)} MiB`
    );

    check(
        'Test 15b — batch completion releases the GPU cache',
        afterBatch.instances === 0 && afterBatch.bytes === 0,
        `after batch: ${afterBatch.instances} instances, ${afterBatch.bytes} bytes; batch ok: ${batchSummary.successful}/3`
    );

    check(
        'Test 15c — the shared GPU device survives repeated release cycles',
        finalDims.width === 1024 && finalDims.height === 1024,
        `4th job after 3 prior jobs + a cache release produced ${finalDims.width}x${finalDims.height}`
    );

    bridge.releaseCache();
    await new Promise((r) => setTimeout(r, 200));
    const afterRelease = await bridge.gpuStats();
    check(
        'Test 15d — explicit release frees every cached instance',
        afterRelease.instances === 0 && afterRelease.bytes === 0,
        `${afterRelease.instances} instances, ${afterRelease.bytes} bytes remaining`
    );
}

/** Test 16: PDF with 10+ images of mixed aspect ratios. */
async function testLargePdf(): Promise<void> {
    const src = await freshDirectory('pdf-src');
    const out = await freshDirectory('pdf-out');
    const controller = makeController(out);
    controller.global = { mode: 'passes', passes: 1, targetLongEdge: 4096 };
    controller.options = { createPdf: true, pdfQuality: 'maximum', pdfName: 'book.pdf' };

    // 12 files, alternating square / 4:3 / 8:5 sources, named to test ordering.
    const sources = ['page_1.png', 'page_2.png', 'wide.jpg'];
    const handles = [];
    for (let i = 1; i <= 12; i++) {
        const source = sources[i % sources.length];
        const file = await fetchFile(source, source.endsWith('jpg') ? 'image/jpeg' : 'image/png');
        const named = new File([file], `page_${i}.${source.endsWith('jpg') ? 'jpg' : 'png'}`, { type: file.type });
        handles.push(await writeInto(src, named));
    }
    await controller.addFiles(handles);

    const summary = await controller.run();
    const pdfBytes = await readFileBytes(out, summary.pdfName!);
    const parsed = await readPdf(pdfBytes);

    // Every page must keep its source aspect ratio.
    const expectedRatios = controller.items.map((item) => item.source.width / item.source.height);
    const pageRatios = parsed.sizes.map((s) => s.width / s.height);
    const ratiosOk = expectedRatios.every((r, i) => Math.abs(r - pageRatios[i]) < 0.01);

    // Natural order: page_1 .. page_12, never page_1, page_10, page_11...
    const order = controller.items.map((i) => i.name);
    const naturalOrder = naturalSort(order, (n) => n);

    check(
        'Test 16a — PDF with 12 images of mixed aspect ratios',
        summary.successful === 12 && parsed.pages === 12,
        `${summary.successful} processed, ${parsed.pages} PDF pages, ${(pdfBytes.length / 1024 ** 2).toFixed(1)} MiB`
    );
    check(
        'Test 16b — no page is stretched',
        ratiosOk,
        pageRatios.map((r) => r.toFixed(3)).join(', ')
    );
    check(
        'Test 16c — 12-image batch keeps natural order (page_2 before page_10)',
        JSON.stringify(order) === JSON.stringify(naturalOrder) &&
        order.indexOf('page_2.png') < order.indexOf('page_10.png'),
        order.join(', ')
    );
}

/** Test 17: video duration, resolution and audio survive a multi-pass run. */
async function testVideoIntegrity(): Promise<void> {
    const src = await freshDirectory('audio-src');
    const out = await freshDirectory('audio-out');
    const controller = makeController(out);
    controller.global = { mode: 'passes', passes: 2, targetLongEdge: 4096 };

    const handle = await writeInto(src, await fetchFile('clip_audio.mp4', 'video/mp4'));
    await controller.addFiles([handle]);

    const sourceInfo = await probeVideo(await (await handle.getFile()).arrayBuffer());
    const summary = await controller.run();
    const item = controller.items[0];

    const outName = item.outputName!;
    const outBytes = await readFileBytes(out, outName);
    const outputInfo = await probeVideo(outBytes.buffer as ArrayBuffer);

    const durationOk = Math.abs(outputInfo.duration - sourceInfo.duration) < 0.25;
    const sizeOk = outputInfo.width === 640 && outputInfo.height === 480;
    const audioOk = sourceInfo.hasAudio === outputInfo.hasAudio && outputInfo.hasAudio;

    check(
        'Test 17a — multi-pass video keeps its real encoded resolution',
        sizeOk && summary.successful === 1,
        `${sourceInfo.width}x${sourceInfo.height} -> ${outputInfo.width}x${outputInfo.height} (2 passes)`
    );
    check(
        'Test 17b — duration preserved',
        durationOk,
        `source ${sourceInfo.duration.toFixed(2)}s -> output ${outputInfo.duration.toFixed(2)}s`
    );
    check(
        'Test 17c — audio track preserved',
        audioOk,
        `source audio: ${sourceInfo.hasAudio}, output audio: ${outputInfo.hasAudio} (${outputInfo.audioCodec || 'none'})`
    );
}

/**
 * Test 18: a longer multi-pass video must not accumulate per-frame resources.
 *
 * The chain of canvases/instances is built once and reused for every frame, so
 * after 75 frames the worker should still hold exactly one instance per pass -
 * not one per frame.
 */
async function testVideoFrameMemory(): Promise<void> {
    bridge.releaseCache();
    await new Promise((r) => setTimeout(r, 200));

    const src = await freshDirectory('long-src');
    const out = await freshDirectory('long-out');
    const controller = makeController(out);
    controller.global = { mode: 'passes', passes: 2, targetLongEdge: 4096 };

    const handle = await writeInto(src, await fetchFile('clip_long.mp4', 'video/mp4'));
    await controller.addFiles([handle]);

    const before = await bridge.gpuStats();
    const started = performance.now();

    // Sample the worker's cache *while* frames are being processed: if anything
    // were retained per frame, this would climb with the frame count.
    let peakInstances = 0;
    let peakBytes = 0;
    let samples = 0;
    const polling = setInterval(async () => {
        const stats = await bridge.gpuStats();
        peakInstances = Math.max(peakInstances, stats.instances);
        peakBytes = Math.max(peakBytes, stats.bytes);
        samples++;
    }, 300);

    const summary = await controller.run();
    clearInterval(polling);
    const elapsed = (performance.now() - started) / 1000;

    const item = controller.items[0];
    const outputInfo = await probeVideo((await readFileBytes(out, item.outputName!)).buffer as ArrayBuffer);
    const after = await bridge.gpuStats();

    check(
        'Test 18a — 75-frame 2-pass video encodes correctly',
        summary.successful === 1 && outputInfo.width === 1280 && outputInfo.height === 960,
        `320x240 -> ${outputInfo.width}x${outputInfo.height}, ${outputInfo.duration.toFixed(2)}s, ` +
        `audio: ${outputInfo.hasAudio}, took ${elapsed.toFixed(1)}s`
    );

    check(
        'Test 18b — per-frame resources are not retained (sampled mid-encode)',
        samples > 0 && peakInstances <= 2 && after.instances === 0 && after.bytes === 0,
        `peak during 75 frames: ${peakInstances} instance(s) / ${(peakBytes / 1024 ** 2).toFixed(0)} MiB ` +
        `over ${samples} samples (2 passes = 2 instances expected); after run: ${after.instances} / ${after.bytes} bytes`
    );

    check(
        'Test 18c — duration preserved over 75 frames',
        Math.abs(outputInfo.duration - 5) < 0.35,
        `expected ~5.00s, got ${outputInfo.duration.toFixed(2)}s`
    );
}

/** Read real properties back out of an encoded MP4. */
async function probeVideo(buffer: ArrayBuffer): Promise<{
    width: number; height: number; duration: number; hasAudio: boolean; audioCodec?: string;
}> {
    const input = new Input({ formats: [MP4, QTFF], source: new BufferSource(buffer) });
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    return {
        width: video ? (video.displayWidth ?? video.codedWidth) : 0,
        height: video ? (video.displayHeight ?? video.codedHeight) : 0,
        duration: await input.computeDuration(),
        hasAudio: !!audio,
        audioCodec: audio?.codec || undefined
    };
}

/** Parse the produced PDF with pdf-lib so the check does not depend on how the
 *  file happens to be serialised (object streams, compression, ...). */
async function readPdf(bytes: Uint8Array): Promise<{ pages: number; sizes: { width: number; height: number }[] }> {
    const doc = await PDFDocument.load(bytes as any);
    return {
        pages: doc.getPageCount(),
        sizes: doc.getPages().map((page) => page.getSize())
    };
}

//=================== Runner ===========================

async function run(): Promise<void> {
    output = document.getElementById('results')!;
    bridge = new WorkerBridge(worker);
    opfsRoot = await navigator.storage.getDirectory();

    worker.onmessage = (event) => {
        if (bridge.handleMessage(event.data)) return;

        if (event.data.cmd === 'isSupported') {
            note(`WebGPU supported: ${event.data.data}; limits: ${JSON.stringify(event.data.caps)}`);
            return;
        }

        // Preview-path (non-job) responses used by the regression tests.
        const index = previewWaiters.findIndex((w) => w.cmd === event.data.cmd);
        if (index >= 0) {
            const waiter = previewWaiters.splice(index, 1)[0];
            clearTimeout(waiter.timer);
            waiter.resolve(event.data);
            return;
        }

        if (event.data.cmd === 'error') {
            const waiter = previewWaiters.shift();
            if (waiter) {
                clearTimeout(waiter.timer);
                waiter.reject(new Error(event.data.data));
            }
        }
    };

    worker.postMessage({ cmd: 'isSupported' });
    await new Promise((resolve) => setTimeout(resolve, 800));

    bridge.registerWeights('medium-rl', weights['medium-rl']);
    bridge.registerWeights('small-rl', weights['small-rl']);

    const tests: [string, () => Promise<any>][] = [
        ['single image passes', testSinglePasses],
        ['three passes', testThreePasses],
        ['target resolution', testTargetResolution],
        ['non-square', testNonSquare],
        ['batch + overrides', testBatchAndOverrides],
        ['folder scan', testFolderScan],
        ['mixed batch + pdf', testMixedBatchAndPdf],
        ['multi-pass video', testMultiPassVideo],
        ['video integrity', testVideoIntegrity],
        ['video frame memory', testVideoFrameMemory],
        ['pdf aspect', testPdfAspect],
        ['large pdf', testLargePdf],
        ['filename collision', testFilenameCollision],
        ['failure isolation', testFailureIsolation],
        ['corrupt scan', testCorruptScan],
        ['cancellation', testCancellation],
        ['gpu lifecycle', testGpuLifecycle],
        ['preview path regression', testPreviewPathRegression],
        ['video preview regression', testVideoPreviewRegression]
    ];

    for (const [name, fn] of tests) {
        try {
            await fn();
        } catch (error: any) {
            report(name, false, `threw: ${error?.message || error}`);
            console.error(error);
        }
    }

    const done = document.createElement('div');
    done.id = 'summary';
    done.className = failed === 0 ? 'summary pass' : 'summary fail';
    done.textContent = `DONE — ${passed} passed, ${failed} failed`;
    output.appendChild(done);
}

document.addEventListener('DOMContentLoaded', run);
