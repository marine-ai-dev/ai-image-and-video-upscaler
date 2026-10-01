# AI Upscaler API

An HTTP API that runs the website's upscaling models — the WebSR `anime4k/cnn-2x-{s,m,l}`
networks with the `rl` / `an` / `3d` weights — on the server, on CPU. It exists so the same
models can be reached from scripts and other services, and so it can be deployed where there
is no GPU (Railway). It produces the same pixels as the website; the website itself is not
served or changed by this service.

> **Privacy: this is not the website.** The website upscales in your browser and uploads
> nothing. **The API is the opposite: every image you send is uploaded to the server and
> processed there.** The site's "nothing is uploaded" promise does not apply to the API. Inputs
> and results are held only for as long as a request or job needs them (results of queued
> jobs are deleted after `JOB_TTL_SECONDS`, default 1 hour, or immediately with `DELETE`),
> nothing is logged about image contents, and API keys are never logged. Do not point this at
> data you would not be willing to send to the server's operator.

v1 handles **images only** (PNG, JPEG, WebP). Video is a later stage; see
[Design notes](#design-notes).

---

## Run it locally

Python 3.9+ (the Docker image uses 3.11).

```bash
cd api
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt        # runtime + pytest
API_KEYS="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')" \
  .venv/bin/uvicorn app.asgi:app --port 8095
# interactive reference docs: http://127.0.0.1:8095/docs
```

The service **refuses to start** (exit code 2, message on stderr) unless `API_KEYS` is set.
For local experiments only you can opt out explicitly: `API_AUTH_DISABLED=1`. It is never open
by default.

```bash
.venv/bin/python -m pytest              # whole suite, ~6 s; prints the browser-parity table
python scripts/sync_weights.py          # refresh api/weights from ../src/weights
python -m app.bench                     # time one pass per model on this machine
```

### curl: synchronous

```bash
KEY=...   # one of API_KEYS
curl -sS -H "Authorization: Bearer $KEY" \
     -F file=@photo.jpg -F model=medium -F content=rl -F passes=2 \
     -D headers.txt -o photo_x4.jpg  http://127.0.0.1:8095/v1/upscale
cat headers.txt     # X-Upscale-Width / -Height / -Passes, Content-Disposition ...

# ask for a size instead of a pass count; the fewest native 2x passes that reach it
curl -sS -H "Authorization: Bearer $KEY" -F file=@photo.png -F target_long_edge=4096 \
     -F format=webp -o out.webp  http://127.0.0.1:8095/v1/upscale
```

### curl: jobs (for big images)

```bash
# 1. submit -> 202 {"id": "...", "status": "queued"}
ID=$(curl -sS -H "Authorization: Bearer $KEY" -F file=@big.png -F model=large -F passes=2 \
       http://127.0.0.1:8095/v1/jobs | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')

# 2. poll -> status queued|running|succeeded|failed, progress 0..1, pass n of m
curl -sS -H "Authorization: Bearer $KEY" http://127.0.0.1:8095/v1/jobs/$ID

# 3. download when "succeeded" (409 job_not_ready before that)
curl -sS -H "Authorization: Bearer $KEY" -o big_x4.png http://127.0.0.1:8095/v1/jobs/$ID/result

# 4. optional: delete the image data now instead of waiting for the TTL
curl -sS -X DELETE -H "Authorization: Bearer $KEY" http://127.0.0.1:8095/v1/jobs/$ID
```

---

## Endpoints

| | |
|---|---|
| `GET /healthz` | Liveness, no auth. |
| `GET /v1/models` | Sizes, content types, formats and the active limits. |
| `POST /v1/upscale` | Multipart, synchronous. Returns the image bytes. |
| `POST /v1/jobs` | Same parameters; `202 {id, status}` and a `Location` header. |
| `GET /v1/jobs/{id}` | Status, progress, error, result metadata. |
| `GET /v1/jobs/{id}/result` | The image bytes. |
| `DELETE /v1/jobs/{id}` | Remove a finished/queued job and its data now. |
| `GET /docs`, `/openapi.json` | OpenAPI reference (public). |

Everything under `/v1` needs `Authorization: Bearer <key>`.

### Parameters (`POST /v1/upscale` and `/v1/jobs`, multipart form)

| field | default | |
|---|---|---|
| `file` | required | PNG, JPEG or WebP. The type is decided by **decoding**, not by extension or `Content-Type`. |
| `model` | `medium` | `small` \| `medium` \| `large` (`anime4k/cnn-2x-s/m/l`). |
| `content` | `rl` | `rl` \| `an` \| `3d` weight set. |
| `passes` | `1` | 1–4 native 2× passes. Exclusive with `target_long_edge`. |
| `target_long_edge` | – | Wanted long edge in px. Same rule as `src/lib/upscale-math.ts` `planForTarget`: the **fewest native passes whose result reaches it**, capped at the maximum. Nothing is ever resampled, so the result is generally *not* exactly the number you asked for (`X-Upscale-Target-Exact: false`). |
| `format` | same as input | `png` \| `jpeg` (`jpg`) \| `webp`. JPEG/WebP use quality 92. |

The result size is always `source × 2^passes`. A sync response carries
`X-Upscale-Width`, `-Height`, `-Passes`, `-Model`, `-Content`, `-Source-Width/-Height`
(and `-Requested-Long-Edge`, `-Target-Exact`, `-Capped-By-Max-Passes` for target mode) plus
`Content-Disposition: attachment; filename="photo_upscaled_4096x4096.png"`, named like the site.

**Transparency** follows the website's PNG path (`worker.ts`, `preserveAlpha`): for PNG output the
model runs on the image composited over the `#fffaf2` matte, and the original alpha channel is
upscaled with Mitchell bicubic (what Chrome's `imageSmoothingQuality = 'high'` does) and put back.
Other output formats have no alpha, as on the site. A PNG with no transparency comes back as RGB.
Embedded colour profiles are converted to sRGB and EXIF orientation is applied, as browsers do.

### Errors

Every error, including 404/405/validation/500, has this shape and a stable `code`:

```json
{"error": {"code": "output_too_large", "message": "The result would be 4096x4096 ..."}}
```

| status | codes |
|---|---|
| 401 | `unauthorized` (+ `WWW-Authenticate: Bearer`) |
| 413 | `payload_too_large`, `input_too_large`, `output_too_large`, `image_too_large` (decompression-bomb guard) |
| 415 | `unsupported_format` (real image, but not PNG/JPEG/WebP) |
| 422 | `invalid_image`, `missing_file`, `invalid_model`, `invalid_content`, `invalid_passes`, `invalid_target`, `invalid_format`, `conflicting_parameters`, `output_too_large_for_format` (WebP ≤ 16383 px, JPEG ≤ 65535 px), `invalid_request` |
| 429 | `rate_limited` (+ `Retry-After`) |
| 404 / 405 | `not_found`, `job_not_found` (also for another key's job), `method_not_allowed` |
| 409 | `job_not_ready`, `job_failed`, `job_running` |
| 503 | `busy` (sync request waited `SYNC_WAIT_SECONDS` for the engine), `queue_full` |
| 500 | `internal_error` (never contains internals) |

Size limits are checked **up front from the image header and the requested passes**, before any
pixel work or queueing. Auth and the rate limit run before the request body is read, and the
upload size is enforced while streaming (so a missing `Content-Length` does not bypass it).

---

## Configuration (environment)

| variable | default | |
|---|---|---|
| `API_KEYS` | – | Comma-separated keys, each ≥ 16 chars. Compared in constant time (SHA-256 digests, `hmac.compare_digest` against every key). Required unless… |
| `API_AUTH_DISABLED` | – | …set to exactly `1` for local dev. Ignored if `API_KEYS` is set. |
| `PORT` | `8080` (Docker) | Listen port (Railway injects it). |
| `MAX_UPLOAD_BYTES` | `20971520` | Upload size limit (20 MiB). |
| `MAX_INPUT_PIXELS` | `8000000` | Also sets Pillow's `MAX_IMAGE_PIXELS` (decompression-bomb guard). |
| `MAX_OUTPUT_PIXELS` | `33554432` | Result pixels (≈ 8192×4096), computed from passes. |
| `MAX_PASSES` | `4` | 1–4. |
| `RATE_LIMIT_PER_MINUTE` | `30` | Per key, sliding window, in memory, on `POST /v1/upscale` and `POST /v1/jobs`. `0` disables. |
| `MAX_QUEUED_JOBS` | `20` | Jobs waiting (not running) before `503 queue_full`. |
| `JOB_TTL_SECONDS` | `3600` | Results (and stale queued jobs) are deleted this long after finishing. |
| `JOB_DIR` | `$TMPDIR/upscaler-api-jobs` | Where inputs/results live. Wiped at startup. |
| `ENGINE_CONCURRENCY` | `1` | Upscales running at once (sync + jobs share this gate). |
| `SYNC_WAIT_SECONDS` | `60` | How long a sync request waits for the engine before `503 busy`. |
| `TILE_PIXELS` | `131072` | Band size for tiled inference; trades memory for nothing (output is identical). |
| `CORS_ALLOW_ORIGINS` | – | Comma-separated allow-list. **CORS is off unless set.** |
| `WEIGHTS_DIR` | `./weights` | |
| `LOG_LEVEL` | `info` | Never logs keys, filenames or image data. |
| `OMP_NUM_THREADS`, `OPENBLAS_NUM_THREADS` | `4` (Docker) | BLAS threads. Set to the vCPUs you actually have. |

Run **one** uvicorn process (`--workers 1`, as the Dockerfile does): the job queue, results and
rate limits are in memory. The store sits behind `app.jobs.JobStore`, so it can be swapped for
Redis + a bucket later without touching the queue or the HTTP layer.

---

## How parity with the browser works

The goal is the same pixels as the site, not "a similar upscaler". The spec is the WebSR source;
the numbers below are measured against outputs captured from the real browser.

**Model.** `app/engine/weights.py` encodes the layer graphs and weight layouts from the WGSL:

* `mat4x4f` is column-major: flat index `m*16 + c*4 + r` is the weight from input channel `c`
  to output channel `r`; the alpha input column is all zero in every shipped weight file, so only
  RGB is evaluated.
* 3×3 kernels enumerate taps with **x as the outer loop** (`k = (dx+1)*3 + (dy+1)`).
* CReLU is `M[i]·max(x,0) + M[i+9]·max(-x,0)`; the 16/56/112-wide layers interleave inputs as in
  `conv2d-{16,56,112}x4.ts` (the large model's last layer sums two halves and adds the bias once).
* **Display layer.** The brief describes `display.ts` (one scalar added to R, G, B). That is the
  *small* model only. `medium` and `large` use `display_3c.ts`: three separate residual maps for
  R, G and B (the fourth value, alpha, is ignored by the opaque canvas). Both pixel-shuffle with
  component `px + 2*py` onto a **repeat-addressed** linear 2× sample (so the image wraps at its
  edges), then round to 8 bit. Between passes the 8-bit result is fed back in, as in `worker.ts`.

**Edges** are where a convolution implementation normally diverges, and here they are not
"padding". Probing WebGPU directly on the target machine (Chrome, Apple/Metal) showed:

* a storage-buffer read at flat index `g` with `g < 0` **or** `g ≥ N` returns element `N-1`
  (negative indices clamp to the *last* pixel, not to 0);
* because layers index flat (`y*W + x`), a 3×3 tap that leaves the image left/right reads the
  neighbouring row's far edge;
* `textureLoad` outside the input clamps per axis with `-1 → size-1`.

`app/engine/forward.py` reproduces exactly that. Zero-padding or edge-replication *inside the
network* produce visibly different borders up to ~14 output px deep (a test guards this). That is
separate from the input padding to a multiple of 8 described next.

### Sizes that are not a multiple of 8

WebSR's compute layers dispatch `floor(W/8) × floor(H/8)` workgroups of 8×8, so on their own a side
that is not a multiple of 8 would leave its last `side % 8` columns/rows of every intermediate buffer
unwritten: those output pixels would get no AI residual, only the plain linear upscale (up to 14
output px strips at the right/bottom of e.g. a 100×76 input, compounding over several passes).

The website avoids this, and the API does the same, with one rule applied to **every pass**:

1. pad the pass input on the right and bottom up to the next multiple of 8 by **replicating the
   edge pixels** (`padded = ceil(size / 8) * 8`; sizes that already are multiples of 8 are not touched);
2. run the network on the padded image (so every pixel of the cropped result has been through the model);
3. crop the 2× result back to exactly `2W × 2H`. The cropped 8-bit result is the next pass's input,
   which is padded again.

The rule lives in `app/engine/padding.py` (`padded_size`, `pad_edge`, `crop_output`) and is applied in
`upscale_pass`. On the website it is `paddedDimensions` / `passGeometry` (`src/lib/upscale-math.ts`)
and `PassFrame` (`src/lib/render-chain.ts`); `tests/test_padding.py` checks the padded sizes against
the TypeScript implementation when Node is installed. Reported and returned dimensions are always
`source × 2^passes`, alpha is upscaled from the unpadded original, and the input/output pixel limits
count the real (unpadded) image. Tiling works on the padded image and equals the untiled result.

The earlier behaviour (reproducing the unpadded dispatch strips) and its `BROWSER_COMPAT_EDGES`
setting were removed together with the website's fix; if that variable is still set in an
environment it is ignored.

### Measured parity

`tests/test_parity.py` compares against every capture in `tests/reference/` (the five from the real
app, all multiples of 8, plus nineteen in `tests/reference/harness/` from the real `@websr/websr`
build run through the website's own pipeline module `src/lib/render-chain.ts` — including its
padding/crop code, which the harness imports rather than copies; see `tests/reference/harness/manifest.json`
and `tests/tools/browser_reference/` to regenerate). On the 0–255 scale, per channel, interior = all but
a 2 px border:

| case | region | max abs (R,G,B,A) | mean abs (R,G,B,A) |
|---|---|---|---|
| small rl 1 pass | interior / border | 1,1,0,0 / 0,0,0,0 | 0.0001,0.0001,0,0 / 0 |
| medium rl 1 pass | interior / border | 0,0,0,0 / 0,0,0,0 | 0 / 0 |
| large rl 1 pass | interior / border | 0,0,0,0 / 0,0,0,0 | 0 / 0 |
| medium rl 2 passes | interior / border | 1,1,0,0 / 0,0,0,0 | 0.0000 / 0 |
| medium rl, alpha 192→384 (PNG) | interior / border | 1,1,1,0 / 0,0,0,0 | 0.0001,0.0004,0.0003,0 / 0 |
| 19 harness captures: 100×76, 69×45 (1–3 passes), 96×75, tiny 5×3 / 3×20 / 6×5, all 3 sizes, `an`, `3d`, alpha 93×61 (1–2 passes), alpha 192, non-PNG path | interior / border | ≤ 1 / ≤ 1 (A ≤ 1) | ≤ 0.0007 / ≤ 0.0016 |

The few ±1 are exact-tie rounding differences between the GPU's bilinear filter and numpy's, never
model differences. Targets were interior max ≤ 2, mean ≤ 0.5; all cases pass for interior **and**
border, including the strips at the right/bottom of non-multiple-of-8 sizes.

### Tiling

Large images are processed in full-width bands of rows with `2 × layers` rows of context
(`NetworkSpec.band_margin`: flat indexing lets one 3×3 layer reach two rows across the row seam).
Because of the browser's "index −1 = last pixel" rule, the top band needs the value of the *global*
last pixel at every layer; the bottom band is processed first and hands those values over. The result
equals the untiled one: `tests/test_tiling.py` checks all three sizes, even and odd
sizes (bands are rows of the padded image) and several band heights (float residuals agree to < 1e-5; pixels are identical or differ by
a single rounding-tie LSB).

### Sizing (measured on an Apple M-series laptop, numpy+Accelerate, one pass, single thread)

| model | 512² → 1024² | 1024² → 2048² | peak RSS (1024² input) |
|---|---|---|---|
| small | 0.10 s | 0.41 s | ~310 MB |
| medium | 0.20 s | 0.87 s | ~330 MB |
| large | 0.38 s | 1.66 s | ~510 MB |

CPU time equals wall time here. Decoding and PNG-encoding a 2048² result adds ~0.2–0.3 s. These are
*not* Railway numbers — Linux/OpenBLAS on shared vCPUs will differ. Run `python -m app.bench` in the
container to measure. Memory is bounded by `TILE_PIXELS`, not by image size: roughly
`60 MB baseline + ~15 B per input pixel (input + result arrays) + ~2 KB (small/medium) to
~3.3 KB (large) × TILE_PIXELS` for the working set, plus the encoded upload and result.

---

## Deploy as a second Railway service (instructions only)

1. In the existing Railway project: **New → GitHub Repo** (same repo) → name it e.g. `upscaler-api`.
2. **Settings → Source → Root Directory: `api`.** Railway then builds `api/Dockerfile`
   (`railway.json` already selects it and sets the `/healthz` health check). Nothing else in the
   repo is part of this service.
3. **Variables:** `API_KEYS` = one or more long random keys (`python3 -c "import secrets; print(secrets.token_urlsafe(32))"`);
   optionally `CORS_ALLOW_ORIGINS`, the limits above, and `OMP_NUM_THREADS`/`OPENBLAS_NUM_THREADS`
   equal to your vCPU count. Do **not** set `API_AUTH_DISABLED`. Without `API_KEYS` the container exits
   on purpose.
4. **Networking:** generate a domain. Railway provides `PORT`; the image listens on it.
5. Size the service from `python -m app.bench` output (CPU matters most; ≥ 1 GB RAM for `large`).
   Keep the replica count at 1 (state is in memory). Attach a volume at `JOB_DIR` only if you want
   job results to survive restarts — they are otherwise lost, by design.
6. When the web app's weights change, run `python scripts/sync_weights.py` and commit `api/weights`
   (a test fails while they differ from `../src/weights`).

The website service is unaffected.

---

## Design notes

* **Why numpy and no ONNX/ONNX Runtime?** The edge behaviour above (flat-index wraparound, a global
  "last pixel") cannot be expressed as ONNX convolution padding, and getting parity
  was the point. The networks are tiny stacks of 3×3 convs on 4-channel buffers, so im2col + BLAS
  matmul is simple, bit-near-exact and fast enough (above), with three small dependencies instead of
  onnx + onnxruntime.
* **Video later.** `app.engine.upscale.upscale_pass` maps a `(H, W, 3) uint8` frame to `(2H, 2W, 3)` and the
  weights are loaded once per `(size, content)`, so a frame loop is a thin layer on top; the job queue
  and store already deal in opaque input/result payloads with progress, and the single-worker
  `EngineGate` is where a GPU/more workers or an external queue would plug in.
* **Layout:** `app/engine/` (weights, forward band, tiling+display, alpha resampling, pipeline),
  `app/service.py` (params, limits, decode→upscale→encode), `app/security.py`, `app/jobs.py`,
  `app/main.py` (routes), `app/asgi.py` (entry point that refuses to start unauthenticated).

## Known limits

* Edge/rounding behaviour was measured on Chrome + Apple/Metal; other GPUs run the same WGSL but
  out-of-range reads are implementation-defined in WebGPU, so a browser on other hardware could differ
  at borders.
* JPEG/WebP encoder output (Pillow, quality 92) is not byte-comparable to the browser's encoders.
* In-memory queue and rate limits: single process only; jobs do not survive a restart.
