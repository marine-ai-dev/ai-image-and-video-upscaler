import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MAX_PASSES,
    NATIVE_SCALE,
    dimensionsAfterPasses,
    estimatePeakBytes,
    evaluateSafety,
    memoryBudgetFor,
    passProgression,
    planForTarget,
    resolveFinalDimensions,
    resolvePasses
} from '../src/lib/upscale-math.ts';

import {
    buildOutputName,
    classifyFile,
    extensionForMime,
    isHiddenFile,
    naturalCompare,
    naturalSort,
    outputMimeForImage,
    uniqueName
} from '../src/lib/media-files.ts';

const SQUARE = { width: 1024, height: 1024 };
const PORTRAIT = { width: 768, height: 1024 };
const LANDSCAPE = { width: 1920, height: 1080 };

test('native scale factor matches the shipped anime4k cnn-2x networks', () => {
    assert.equal(NATIVE_SCALE, 2);
});

test('dimensionsAfterPasses doubles both axes per pass', () => {
    assert.deepEqual(dimensionsAfterPasses(SQUARE, 1), { width: 2048, height: 2048 });
    assert.deepEqual(dimensionsAfterPasses(SQUARE, 2), { width: 4096, height: 4096 });
    assert.deepEqual(dimensionsAfterPasses(SQUARE, 3), { width: 8192, height: 8192 });
});

test('progression matches the documented example', () => {
    assert.deepEqual(passProgression(SQUARE, 3), [
        { width: 2048, height: 2048 },
        { width: 4096, height: 4096 },
        { width: 8192, height: 8192 }
    ]);
});

test('aspect ratio is preserved for non-square sources', () => {
    const result = dimensionsAfterPasses(PORTRAIT, 2);
    assert.deepEqual(result, { width: 3072, height: 4096 });

    const sourceRatio = PORTRAIT.width / PORTRAIT.height;
    const resultRatio = result.width / result.height;
    assert.equal(sourceRatio, resultRatio);

    // 1024x768 must never become 4096x4096
    const wide = dimensionsAfterPasses({ width: 1024, height: 768 }, 2);
    assert.deepEqual(wide, { width: 4096, height: 3072 });
    assert.notEqual(wide.height, wide.width);
});

test('target mode picks the smallest pass count that reaches the request', () => {
    const exact = planForTarget(SQUARE, 4096);
    assert.equal(exact.passes, 2);
    assert.deepEqual(exact.result, { width: 4096, height: 4096 });
    assert.equal(exact.exact, true);

    // 3000 is not reachable natively; 2 passes (4096) is the closest that reaches it.
    const overshoot = planForTarget(SQUARE, 3000);
    assert.equal(overshoot.passes, 2);
    assert.equal(overshoot.exact, false);
    assert.deepEqual(overshoot.result, { width: 4096, height: 4096 });

    // Requested 4000 -> native 4096, the example from the spec.
    const requested4000 = planForTarget(SQUARE, 4000);
    assert.equal(requested4000.passes, 2);
    assert.equal(requested4000.result.width, 4096);
    assert.equal(requested4000.exact, false);
});

test('target mode is driven by the long edge and keeps aspect ratio', () => {
    const plan = planForTarget(PORTRAIT, 4096);
    assert.equal(plan.passes, 2);
    assert.deepEqual(plan.result, { width: 3072, height: 4096 });
});

test('target mode reports when it is capped by the pass limit', () => {
    const plan = planForTarget(SQUARE, 100000, MAX_PASSES);
    assert.equal(plan.passes, MAX_PASSES);
    assert.equal(plan.cappedByMaxPasses, true);
});

test('target below the source resolution still runs a single pass and says so', () => {
    const plan = planForTarget(LANDSCAPE, 800);
    assert.equal(plan.alreadyAtOrAboveTarget, true);
    assert.equal(plan.passes, 1);
});

test('resolvePasses honours both modes and clamps to the maximum', () => {
    assert.equal(resolvePasses(SQUARE, { mode: 'passes', passes: 3, targetLongEdge: 0 }), 3);
    assert.equal(resolvePasses(SQUARE, { mode: 'passes', passes: 99, targetLongEdge: 0 }), MAX_PASSES);
    assert.equal(resolvePasses(SQUARE, { mode: 'target', passes: 1, targetLongEdge: 4096 }), 2);

    assert.deepEqual(
        resolveFinalDimensions(PORTRAIT, { mode: 'target', passes: 1, targetLongEdge: 4096 }),
        { width: 3072, height: 4096 }
    );
});

test('safety blocks passes that exceed the real GPU texture limit', () => {
    const caps = { maxTextureDimension: 8192, maxStorageBufferBindingSize: 2 * 1024 ** 3 };

    const ok = evaluateSafety({ source: SQUARE, passes: 3, caps });
    assert.equal(ok.level !== 'block', true);
    assert.equal(ok.maxSafePasses, 3);

    const blocked = evaluateSafety({ source: SQUARE, passes: 4, caps });
    assert.equal(blocked.level, 'block');
    assert.match(blocked.reasons[0], /16384x16384/);
    assert.match(blocked.reasons[0], /8192px per side/);
});

test('safety blocks when an intermediate buffer exceeds the storage limit', () => {
    // Default WebGPU limit: a 4096x4096 pass needs 256 MiB per buffer.
    const caps = { maxTextureDimension: 16384, maxStorageBufferBindingSize: 128 * 1024 * 1024 };
    const report = evaluateSafety({ source: SQUARE, passes: 3, caps });
    assert.equal(report.level, 'block');
    assert.equal(report.maxSafePasses, 2);
    assert.match(report.reasons[0], /intermediate GPU buffer/);
});

test('safety warns (but does not block) for very large but possible outputs', () => {
    const caps = { maxTextureDimension: 16384, maxStorageBufferBindingSize: 4 * 1024 ** 3 };
    const report = evaluateSafety({ source: SQUARE, passes: 4, caps });
    assert.equal(report.level, 'warn');
    assert.deepEqual(report.finalDimensions, { width: 16384, height: 16384 });
    assert.match(report.reasons[0], /16384x16384/);
});

test('peak memory counts every pass, not just the largest one', () => {
    // Every pass in a chain is held at once, so the total is the sum.
    const perPixel = 160; // medium network: 10 rgba32float buffers
    const peak = estimatePeakBytes(SQUARE, 2, perPixel, true);

    const instances = 1024 * 1024 * perPixel + 2048 * 2048 * perPixel;
    const encode = 4096 * 4096 * 20;
    assert.equal(peak, instances + encode);

    // and it must grow faster than the largest single pass alone
    assert.equal(peak > 2048 * 2048 * perPixel, true);
});

test('memory budget is half of reported device RAM', () => {
    assert.equal(memoryBudgetFor(8), 8 * 1024 ** 3 * 0.5);
    assert.equal(memoryBudgetFor(undefined), 4 * 1024 ** 3 * 0.5);
});

test('an allowed texture size can still be blocked by working memory', () => {
    // 16384px textures and 4 GiB bindings are permitted by this GPU...
    const caps = { maxTextureDimension: 16384, maxStorageBufferBindingSize: 4 * 1024 ** 3 };
    const budget = memoryBudgetFor(8);

    // Risk is communicated progressively: quiet, then a warning, then a refusal.
    const onePass = evaluateSafety({
        source: SQUARE, passes: 1, networkSize: 'medium', caps, memoryBudgetBytes: budget
    });
    assert.equal(onePass.level, 'ok');

    const twoPasses = evaluateSafety({
        source: SQUARE, passes: 2, networkSize: 'medium', caps, memoryBudgetBytes: budget
    });
    assert.equal(twoPasses.level, 'warn');
    assert.match(twoPasses.reasons[0], /4096x4096/);

    // ...but three passes need ~4.9 GiB of working memory, which is not.
    const threePasses = evaluateSafety({
        source: SQUARE, passes: 3, networkSize: 'medium', caps, memoryBudgetBytes: budget
    });
    assert.equal(threePasses.level, 'block');
    assert.equal(threePasses.maxSafePasses, 2);
    assert.match(threePasses.reasons[0], /working\s+memory/);
    assert.match(threePasses.reasons[1], /up to 2 passes \(4096 x 4096\)/);
});

test('memory checks are skipped when no budget is known', () => {
    const caps = { maxTextureDimension: 16384, maxStorageBufferBindingSize: 4 * 1024 ** 3 };
    const report = evaluateSafety({ source: SQUARE, passes: 3, networkSize: 'medium', caps });
    assert.equal(report.level !== 'block', true);
});

test('a measured bytes-per-pixel figure overrides the static estimate', () => {
    const caps = { maxTextureDimension: 16384, maxStorageBufferBindingSize: 4 * 1024 ** 3 };
    const budget = memoryBudgetFor(8);

    // A network that is far cheaper than the fallback assumes makes 3 passes fit.
    const measured = evaluateSafety({
        source: SQUARE, passes: 3, networkSize: 'medium', caps,
        memoryBudgetBytes: budget, bytesPerInputPixel: 16
    });
    assert.equal(measured.level !== 'block', true);
    assert.equal(measured.estimatedGpuBytes < 2 * 1024 ** 3, true);
});

test('file classification only accepts what the pipeline can process', () => {
    assert.equal(classifyFile('photo.PNG'), 'image');
    assert.equal(classifyFile('photo.jpeg'), 'image');
    assert.equal(classifyFile('photo.webp'), 'image');
    assert.equal(classifyFile('clip.mp4'), 'video');
    assert.equal(classifyFile('clip.mov'), 'video');
    assert.equal(classifyFile('notes.txt'), 'unsupported');
    assert.equal(classifyFile('data.json'), 'unsupported');
    assert.equal(classifyFile('book.pdf'), 'unsupported');
    assert.equal(classifyFile('no-extension'), 'unsupported');
});

test('hidden and system files are recognised', () => {
    assert.equal(isHiddenFile('.DS_Store'), true);
    assert.equal(isHiddenFile('Thumbs.db'), true);
    assert.equal(isHiddenFile('photo.png'), false);
});

test('output names describe the real resolution and never collide', () => {
    assert.equal(
        buildOutputName('photo.png', { width: 4096, height: 4096 }, 'png'),
        'photo_upscaled_4096x4096.png'
    );
    assert.equal(
        buildOutputName('clip.mp4', { width: 3840, height: 2160 }, 'mp4'),
        'clip_upscaled_3840x2160.mp4'
    );

    const taken = new Set<string>();
    assert.equal(uniqueName('a_upscaled_100x100.png', taken), 'a_upscaled_100x100.png');
    assert.equal(uniqueName('a_upscaled_100x100.png', taken), 'a_upscaled_100x100 (2).png');
    assert.equal(uniqueName('a_upscaled_100x100.png', taken), 'a_upscaled_100x100 (3).png');
});

test('output mime mapping keeps the source format', () => {
    assert.equal(outputMimeForImage('a.png'), 'image/png');
    assert.equal(outputMimeForImage('a.JPG'), 'image/jpeg');
    assert.equal(outputMimeForImage('a.webp'), 'image/webp');
    assert.equal(extensionForMime('image/jpeg'), 'jpg');
    assert.equal(extensionForMime('image/png'), 'png');
});

test('natural sorting puts page_2 before page_10', () => {
    const names = ['page_10.png', 'page_2.png', 'page_1.png', 'page_20.png', 'page_3.png'];
    const sorted = naturalSort(names, (n) => n);
    assert.deepEqual(sorted, ['page_1.png', 'page_2.png', 'page_3.png', 'page_10.png', 'page_20.png']);

    // Lexical ordering would produce page_1, page_10, page_2 - make sure we do not.
    assert.equal(naturalCompare('page_2.png', 'page_10.png') < 0, true);
    assert.equal(naturalCompare('img12', 'img12') === 0, true);
});
