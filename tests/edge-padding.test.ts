import test from 'node:test';
import assert from 'node:assert/strict';

import {
    WORKGROUP_SIZE,
    alignUp,
    dimensionsAfterPasses,
    estimatePeakBytes,
    evaluateSafety,
    needsPadding,
    paddedDimensions,
    passGeometries,
    passGeometry,
    resolveFinalDimensions
} from '../src/lib/upscale-math.ts';

/*
 * WebSR dispatches floor(size / 8) workgroups, so every model pass runs on an
 * input padded to a multiple of 8 and its output is cropped back to exactly
 * 2x the logical input. These are the pure rules; the pixels are checked in a
 * real browser (see api/tests/tools/browser_reference and the test harness).
 */

test('the workgroup size matches the WebSR compute layers', () => {
    assert.equal(WORKGROUP_SIZE, 8);
});

test('alignUp rounds up to the next multiple and keeps multiples', () => {
    assert.deepEqual([1, 7, 8, 9, 15, 16, 17, 100, 4096].map((n) => alignUp(n)), [8, 8, 8, 16, 16, 16, 24, 104, 4096]);
    for (let n = 1; n <= 300; n++) {
        const padded = alignUp(n);
        assert.equal(padded % 8, 0);
        assert.ok(padded >= n && padded - n < 8, `alignUp(${n})`);
    }
});

test('paddedDimensions pads each side independently', () => {
    assert.deepEqual(paddedDimensions({ width: 100, height: 76 }), { width: 104, height: 80 });
    assert.deepEqual(paddedDimensions({ width: 96, height: 75 }), { width: 96, height: 80 });
    assert.deepEqual(paddedDimensions({ width: 5, height: 3 }), { width: 8, height: 8 });
    assert.deepEqual(paddedDimensions({ width: 64, height: 64 }), { width: 64, height: 64 });
});

test('multiples of 8 need no padding (zero-cost path)', () => {
    assert.equal(needsPadding({ width: 64, height: 64 }), false);
    assert.equal(needsPadding({ width: 1920, height: 1080 }), false);
    assert.equal(needsPadding({ width: 160, height: 120 }), false);
    assert.equal(needsPadding({ width: 100, height: 76 }), true);
    assert.equal(needsPadding({ width: 96, height: 75 }), true);
    assert.equal(needsPadding({ width: 7, height: 8 }), true);
});

test('passGeometry: logical output is exactly 2x, crop is anchored at the origin', () => {
    const g = passGeometry({ width: 100, height: 76 });
    assert.deepEqual(g.input, { width: 100, height: 76 });
    assert.deepEqual(g.padded, { width: 104, height: 80 });
    assert.deepEqual(g.paddedOutput, { width: 208, height: 160 });
    assert.deepEqual(g.output, { width: 200, height: 152 });
    assert.deepEqual(g.crop, { x: 0, y: 0, width: 200, height: 152 });
    assert.equal(g.padding, true);
});

test('passGeometry of an aligned input is a pass-through', () => {
    const g = passGeometry({ width: 64, height: 64 });
    assert.equal(g.padding, false);
    assert.deepEqual(g.padded, g.input);
    assert.deepEqual(g.paddedOutput, g.output);
    assert.deepEqual(g.crop, { x: 0, y: 0, width: 128, height: 128 });
});

test('the crop never exceeds the padded output, for any size', () => {
    for (let w = 1; w <= 70; w++) {
        for (const h of [1, 3, 8, 13, 64]) {
            const g = passGeometry({ width: w, height: h });
            assert.equal(g.crop.width, w * 2);
            assert.equal(g.crop.height, h * 2);
            assert.ok(g.crop.width <= g.paddedOutput.width && g.crop.height <= g.paddedOutput.height);
            assert.ok(g.paddedOutput.width % 16 === 0 && g.paddedOutput.height % 16 === 0);
        }
    }
});

test('each pass of a chain pads its own cropped input', () => {
    const chain = passGeometries({ width: 69, height: 45 }, 3);
    assert.deepEqual(chain.map((g) => g.input), [
        { width: 69, height: 45 },
        { width: 138, height: 90 },
        { width: 276, height: 180 }
    ]);
    assert.deepEqual(chain.map((g) => g.padded), [
        { width: 72, height: 48 },
        { width: 144, height: 96 },
        { width: 280, height: 184 }
    ]);
    // Output dimensions are unaffected by padding: source x 2^passes.
    assert.deepEqual(chain[2].output, dimensionsAfterPasses({ width: 69, height: 45 }, 3));
    assert.deepEqual(chain.map((g) => g.padding), [true, true, true]);
});

test('a chain whose later passes are aligned only pads where needed', () => {
    // 100x76 -> 200x152 -> 400x304: only the first pass (100 % 8 = 4) needs padding.
    const chain = passGeometries({ width: 100, height: 76 }, 3);
    assert.deepEqual(chain.map((g) => g.padding), [true, false, false]);
    assert.deepEqual(chain.map((g) => g.padded), [
        { width: 104, height: 80 },
        { width: 200, height: 152 },
        { width: 400, height: 304 }
    ]);
    assert.deepEqual(passGeometries({ width: 64, height: 64 }, 4).map((g) => g.padding), [false, false, false, false]);
});

test('planning and reported dimensions stay in logical pixels', () => {
    const source = { width: 100, height: 76 };
    assert.deepEqual(resolveFinalDimensions(source, { mode: 'passes', passes: 2, targetLongEdge: 4096 }), { width: 400, height: 304 });
});

//=================== Resource safety uses the padded size ===========================

const CAPS = { maxTextureDimension: 8192, maxStorageBufferBindingSize: 128 * 1024 * 1024 };

test('estimatePeakBytes is unchanged for sizes that are multiples of 8', () => {
    const source = { width: 1024, height: 1024 };
    const perPixel = 160;
    const expected =
        1024 * 1024 * perPixel + 2048 * 2048 * perPixel + // instances of passes 1 and 2
        4096 * 4096 * 20; // PNG encode buffers at the 4096x4096 output
    assert.equal(estimatePeakBytes(source, 2, perPixel, true), expected);
});

test('estimatePeakBytes charges instances at the padded size and adds the crop canvas', () => {
    const perPixel = 160;
    const aligned = estimatePeakBytes({ width: 104, height: 80 }, 1, perPixel, true);
    const odd = estimatePeakBytes({ width: 100, height: 76 }, 1, perPixel, true);
    // same padded instance, but a smaller (logical) encode plus a 4 B/px crop canvas
    assert.equal(odd, 104 * 80 * perPixel + 200 * 152 * (20 + 4));
    assert.ok(odd > 104 * 80 * perPixel);
    assert.equal(aligned, 104 * 80 * perPixel + 208 * 160 * 20);
});

test('the texture limit is checked against the padded pass output', () => {
    // 4093 -> logical 8186 fits 8192, padded 4096 -> 8192 still fits.
    assert.equal(evaluateSafety({ source: { width: 4093, height: 100 }, passes: 1, caps: CAPS }).level === 'block', false);

    // A device limit that is not a multiple of 16 can be exceeded only by the padding.
    const caps = { maxTextureDimension: 8190, maxStorageBufferBindingSize: 1024 ** 3 };
    const logicalFits = 2 * 4091; // 8182 <= 8190
    const paddedOutput = 2 * alignUp(4091); // 8192 > 8190
    assert.ok(logicalFits <= caps.maxTextureDimension && paddedOutput > caps.maxTextureDimension);
    const report = evaluateSafety({ source: { width: 4091, height: 100 }, passes: 1, caps });
    assert.equal(report.level, 'block');
    assert.equal(report.reasons[0].key, 'safety.block_texture');
    assert.deepEqual(
        { width: report.reasons[0].params!.width, height: report.reasons[0].params!.height },
        { width: 8192, height: 208 }
    );
    assert.equal(report.maxSafePasses, 0);
});

test('the storage-buffer limit is checked against the padded input pixels', () => {
    // 5792 x 5792 = 33.5M px * 16 B = 536.8 MB; padded 5792 -> 5792 (multiple of 8): pick a size where padding tips it over.
    const px = (n: number) => n * n * 16;
    const limit = px(5790) + 1; // logical 5790x5790 fits the limit
    assert.ok(px(alignUp(5790)) > limit);
    const caps = { maxTextureDimension: 65536, maxStorageBufferBindingSize: limit };
    const report = evaluateSafety({ source: { width: 5790, height: 5790 }, passes: 1, caps });
    assert.equal(report.level, 'block');
    assert.equal(report.reasons[0].key, 'safety.block_buffer');
});

test('aligned sizes keep their previous verdicts', () => {
    const ok = evaluateSafety({ source: { width: 1024, height: 1024 }, passes: 2, caps: CAPS });
    assert.equal(ok.level === 'block', false);
    const roomy = { maxTextureDimension: 8192, maxStorageBufferBindingSize: 1024 ** 3 };
    const blocked = evaluateSafety({ source: { width: 2048, height: 2048 }, passes: 3, caps: roomy });
    assert.equal(blocked.level, 'block');
    assert.equal(blocked.reasons[0].key, 'safety.block_texture');
    assert.deepEqual(blocked.finalDimensions, { width: 16384, height: 16384 });
});
