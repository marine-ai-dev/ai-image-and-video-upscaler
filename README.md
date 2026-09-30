# AI Image & Video Upscaler

Upscale images and video with AI **entirely in your browser**. Files are processed on your
own device with WebGPU — nothing is uploaded, and there is no account, no installation and
no telemetry.

Available in **English** and **Ukrainian**, with a built-in image editor.

---

## Contents

* [Features](#features)
* [Quick start](#quick-start)
* [Multi-pass upscaling](#multi-pass-upscaling)
* [Batch processing](#batch-processing)
* [PDF export](#pdf-export)
* [Image editor](#image-editor)
* [Languages](#languages)
* [Resource safety](#resource-safety)
* [Architecture](#architecture)
* [Testing](#testing)
* [Limitations](#limitations)
* [Licence](#licence)
* [Open-source acknowledgement](#open-source-acknowledgement)

---

## Features

| | |
|---|---|
| **Images and video** | PNG, JPG and WebP images; MP4, MOV and M4V video |
| **Multi-pass** | Run 1–4 model passes, or name a target resolution |
| **Batch** | Multiple files or a whole folder, with per-file overrides |
| **PDF export** | Processed images collected into a PDF, in natural order |
| **Image editor** | Crop, curves, colour, filters, blur and retouch |
| **Bilingual** | Complete English and Ukrainian versions at `/en/` and `/uk/` |
| **Local only** | WebGPU on your own device; no uploads, no analytics |

---

## Quick start

```bash
npm install
npm run serve      # http://localhost:8080
```

Requires a desktop version of **Chrome or Edge** — the app needs WebGPU, WebCodecs and the
File System Access API.

| Command | Purpose |
|---|---|
| `npm run serve` | Development server |
| `npm run build` | Production bundle into `dist/` |
| `npm test` | Unit tests for planning, safety and naming logic |
| `npm run type-check` | `tsc --noEmit` |
| `npm run serve:test` | Development server plus the browser pipeline test page |

---

## Multi-pass upscaling

The bundled models are **2× networks**: one pass doubles each dimension. Multiple passes
feed each result straight back in, with no resampling in between.

**Number of passes** — pick 1–4 and see exactly what you will get first:

```
Original:  1024 × 1024
Pass 1 →   2048 × 2048
Pass 2 →   4096 × 4096
Final expected resolution: 4096 × 4096
```

**Target resolution** — name the long edge you want and the app picks the fewest native
passes that reach it. Because only the model's own 2× steps are used, the result is often
not exactly the number you typed, and the interface says so instead of silently resampling:

```
Requested 4000px long edge → native AI result 4096 × 4096
```

The aspect ratio is always preserved: `1024 × 768` becomes `4096 × 3072`, never
`4096 × 4096`.

> **Resolution is not quality.** These figures are pixel dimensions. Upscaling a soft or
> heavily compressed source cannot recover detail that was never captured, so the interface
> reports resolutions and pass counts rather than claims about quality.

---

## Batch processing

Three input modes: **single file**, **multiple files**, and **folder** (with an opt-in
subfolder scan). Unsupported entries — other file types, hidden files, subfolders when
recursion is off — are listed as ignored rather than failing the scan.

Settings work as global defaults plus optional per-file overrides. Files are processed one
at a time, because they share a single GPU and model cache. If one file fails it is marked
as failed with the reason and the batch continues; **Cancel** stops after the current file
finishes safely.

Results are written to `<folder>/upscaled/`, or to a folder you choose, falling back to
ordinary browser downloads. Originals are never modified, names state the real resolution,
and existing files are never silently overwritten:

```
photo.png  →  photo_upscaled_4096x4096.png
clip.mp4   →  clip_upscaled_3840x2160.mp4
           →  photo_upscaled_4096x4096 (2).png    # when the name is taken
```

After every file the produced image or video is checked against the promised resolution; a
mismatch is reported as a failure rather than silently accepted.

---

## PDF export

Optionally collect a batch's images into a PDF. Videos are still upscaled, but never placed
in the PDF.

* **Order** — natural filename order, so `page_2` precedes `page_10`.
* **Pages** — one page per image, sized to that image's own pixel dimensions, so nothing is
  stretched or cropped.
* **Quality** — *Maximum* embeds JPEG bytes verbatim and PNG losslessly. *Balanced*
  re-encodes to JPEG for a smaller file. Any change to an image is reported in the summary;
  quality is never reduced silently.

---

## Image editor

A second workspace for editing rather than upscaling: crop and straighten, curves, colour
adjustment, filters, blend, blur, presets and healing. It runs in the same page, shares the
application's language and theme, and processes images locally like the rest of the product.

---

## Languages

English and Ukrainian are both complete versions of the product, not a partially translated
interface. Each is a real, bookmarkable URL:

```
/en/     English
/uk/     Українська
/        redirects to the remembered or best-matching language
```

Each page is rendered in its language **at build time**, so `<html lang>`, the title,
description and social metadata are correct on arrival and there is no flash of the wrong
language. Strings built at runtime — statuses, progress, plans, warnings, errors — come from
the same dictionaries, including Ukrainian plural forms. The chosen language is remembered,
and switching language never resets the theme.

Adding a language means adding `src/locales/<code>.json` and registering it in
`src/lib/i18n.ts` and `webpack.config.js`.

---

## Resource safety

Before running, a job is checked against two separate things:

1. **Hard device limits** — `maxTextureDimension2D` and `maxStorageBufferBindingSize`
   reported by your GPU.
2. **Projected working memory** — an advertised WebGPU maximum is not available memory.
   Every pass in a chain is held at once, plus the output canvas and encode buffers. The
   per-pixel cost is *measured* from the model's real allocations, not guessed.

Risk escalates gradually — quiet, then a warning, then a refusal with the reason and the
largest pass count that does fit. For video the app also asks the platform whether it can
encode the final resolution at all before spending time on frames it could never mux.

---

## Architecture

| Path | Purpose |
|---|---|
| `src/lib/i18n.ts` | Translation core: `t()`, message descriptors, plurals |
| `src/locales/*.json` | One dictionary per language |
| `src/lib/upscale-math.ts` | Pass planning, target resolution, safety checks |
| `src/lib/media-files.ts` | File classification, natural sort, output naming |
| `src/lib/pdf-export.ts` | PDF building |
| `src/batch/` | Batch queue orchestration and the worker bridge |
| `src/worker.ts` | All GPU work: model instances, pass chain, video encode |
| `src/index.ts` | UI wiring, single-file flow, language and theme |
| `src/edit-images-app/` | Built image editor, embedded as a sub-application |

Code that runs away from the DOM never builds sentences. It returns a message descriptor —
a key plus parameters — and only the UI turns that into text, so an untranslated string
cannot leak out of the worker or the planning maths.

**GPU lifecycle.** One model instance is bound to one input resolution, so instances are
cached per resolution and reused across passes and files. They are released by destroying
what they own — storage buffers, textures, layer uniforms and the backing canvas — because
destroying the model would destroy the shared `GPUDevice`. The cache is bounded by bytes,
and released when a batch finishes.

---

## Testing

```bash
npm test             # unit tests
npm run serve:test   # then open /test-harness.html
```

The harness drives the real worker, real WebGPU and the real encoders over sample media,
covering multi-pass images and video, target resolution, aspect ratio, batch queues,
per-file overrides, folder scanning, filename collisions, PDF output, cancellation, GPU
resource lifecycle and failure isolation. It is only bundled when `INCLUDE_TEST_HARNESS=1`
is set and never ships in a normal build.

---

## Deployment

The build is a set of static files, so any static host works. The bundled
`server.js` is a dependency-free Node server that serves `dist/` on `$PORT`,
which is what the production deployment runs:

```bash
npm run build
npm start          # serves dist/ on $PORT (default 8080)
```

On Railway, `railway up` from the repository root is enough — the build and
start scripts are detected automatically, no configuration file needed. A
secure origin is required in production: WebGPU and the File System Access API
only work over HTTPS.

---

## Limitations

* Desktop Chrome or Edge only — other browsers lack the required APIs.
* The memory budget is a heuristic: WebGPU exposes no available-VRAM query, so the ceiling
  is derived from the memory the browser reports.
* Upscaling cannot recover detail a source never captured.
* Batch video keeps the encoded result in memory when no output folder is chosen.

---

## Licence

MIT — see [LICENSE](LICENSE).

## Open-source acknowledgement

This project builds on MIT-licensed open-source work, including the
[WebSR](https://github.com/sb2702/websr) super-resolution SDK and
[free-ai-video-upscaler](https://github.com/sb2702/free-ai-video-upscaler) by Samrat
Bhattacharyya, the [Anime4K](https://github.com/bloc97/Anime4K) networks, and the
[mini-photo-editor](https://github.com/xdadda/mini-photo-editor) editor. Full copyright and
licence details are in [LICENSE](LICENSE).
