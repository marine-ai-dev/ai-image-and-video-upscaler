"""FastAPI application factory."""
from __future__ import annotations

import logging
import warnings
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.security import HTTPBearer
from PIL import Image
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import __version__
from .config import Settings
from .engine.weights import CONTENTS, SIZES
from .errors import ApiError
from .imageio import FORMAT_MAX_EDGE
from .jobs import FAILED, SUCCEEDED, JobQueue, JobRecord, JobStore, LocalJobStore
from .planning import MAX_PASSES
from .security import Authenticator, RateLimiter, SecurityMiddleware
from .service import (
    EngineGate,
    UpscaleParams,
    UpscaleResult,
    normalise_params,
    output_filename,
    precheck,
    run_upscale,
)

log = logging.getLogger("upscaler")

_bearer = HTTPBearer(auto_error=False, description="Authorization: Bearer <API key>")

CONTENT_DESCRIPTIONS = {
    "rl": "Real-life photos and footage (the website's default).",
    "an": "Animation and anime.",
    "3d": "3D-rendered / CGI content.",
}
SIZE_DESCRIPTIONS = {
    "small": "Fastest, smallest network (anime4k cnn-2x-s).",
    "medium": "Balanced (anime4k cnn-2x-m). Default.",
    "large": "Slowest, highest quality (anime4k cnn-2x-l).",
}

ERROR_RESPONSES: Dict[int, Dict[str, Any]] = {
    code: {"description": desc, "content": {"application/json": {"example": {"error": {"code": "...", "message": "..."}}}}}
    for code, desc in {
        401: "Missing or invalid API key.",
        413: "Upload, input or output size over a limit.",
        415: "Not a PNG, JPEG or WebP image.",
        422: "Invalid parameters or an undecodable image.",
        429: "Rate limit exceeded.",
        503: "Engine busy or queue full; retry later.",
    }.items()
}


def _iso(ts: Optional[float]) -> Optional[str]:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _job_view(rec: JobRecord, ttl: int) -> Dict[str, Any]:
    finished = rec.finished_at
    return {
        "id": rec.id,
        "status": rec.status,
        "progress": rec.progress,
        "pass": rec.pass_no,
        "passes": rec.passes,
        "params": rec.params,
        "error": rec.error,
        "result": rec.result,
        "created_at": _iso(rec.created_at),
        "started_at": _iso(rec.started_at),
        "finished_at": _iso(finished),
        "expires_at": _iso((finished or rec.created_at) + ttl),
    }


def _result_headers(result: UpscaleResult) -> Dict[str, str]:
    plan = result.plan
    h = {
        "X-Upscale-Width": str(result.width),
        "X-Upscale-Height": str(result.height),
        "X-Upscale-Passes": str(result.passes),
        "X-Upscale-Model": plan.model,
        "X-Upscale-Content": plan.content,
        "X-Upscale-Source-Width": str(plan.source_width),
        "X-Upscale-Source-Height": str(plan.source_height),
        "Cache-Control": "no-store",
    }
    if plan.target is not None:
        h["X-Upscale-Requested-Long-Edge"] = str(plan.target.requested_long_edge)
        h["X-Upscale-Target-Exact"] = "true" if plan.target.exact else "false"
        if plan.target.capped_by_max_passes:
            h["X-Upscale-Capped-By-Max-Passes"] = "true"
    return h


def create_app(settings: Optional[Settings] = None, store: Optional[JobStore] = None) -> FastAPI:
    """Build the app. Raises ConfigError if authentication is not configured."""
    settings = settings or Settings.from_env()
    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
    # Pillow's decompression-bomb guard: refuse anything past 2x this outright.
    Image.MAX_IMAGE_PIXELS = settings.max_input_pixels
    # Pillow only warns between 1x and 2x of the limit; our own check right after
    # rejects those with a precise message, so the warning is just noise.
    warnings.filterwarnings("ignore", category=Image.DecompressionBombWarning)

    gate = EngineGate(settings.engine_concurrency)
    store = store or LocalJobStore(settings.resolved_job_dir())
    queue_ = JobQueue(store, settings, gate)
    authenticator = Authenticator(settings)
    limiter = RateLimiter(settings.rate_limit_per_minute)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        queue_.start()
        try:
            yield
        finally:
            queue_.stop()

    app = FastAPI(
        title="AI Upscaler API",
        version=__version__,
        description=(
            "Runs the website's anime4k cnn-2x-{s,m,l} models on the server (CPU). "
            "Unlike the website, **images you send here are uploaded to this server**."
        ),
        lifespan=lifespan,
        redoc_url=None,
    )
    app.state.settings = settings
    app.state.queue = queue_
    app.state.gate = gate
    app.state.limiter = limiter

    # ---- errors: one JSON shape -------------------------------------------------
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return JSONResponse(exc.body(), status_code=exc.status, headers=exc.headers or None)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return JSONResponse(
            {"error": {"code": code, "message": str(exc.detail)}},
            status_code=exc.status_code,
            headers=getattr(exc, "headers", None) or None,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
        return JSONResponse(
            {"error": {"code": "invalid_request", "message": f"{loc}: {first.get('msg', 'invalid request')}".strip(": ")}},
            status_code=422,
        )

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception):
        log.error("unhandled %s", type(exc).__name__)  # type only: never log payloads
        return JSONResponse(
            {"error": {"code": "internal_error", "message": "Unexpected server error."}}, status_code=500
        )

    # ---- middleware (CORS must be outermost so preflights skip auth) --------------
    app.add_middleware(SecurityMiddleware, settings=settings, authenticator=authenticator, limiter=limiter)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type"],
            expose_headers=[
                "X-Upscale-Width", "X-Upscale-Height", "X-Upscale-Passes", "X-Upscale-Model",
                "X-Upscale-Content", "X-Upscale-Source-Width", "X-Upscale-Source-Height",
                "X-Upscale-Requested-Long-Edge", "X-Upscale-Target-Exact", "X-Upscale-Capped-By-Max-Passes",
                "Content-Disposition", "Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining",
            ],
            max_age=600,
        )

    # ---- routes -----------------------------------------------------------------
    @app.get("/healthz", tags=["meta"], summary="Liveness probe (no auth)")
    async def healthz():
        return {"status": "ok", "version": __version__}

    v1 = APIRouter(prefix="/v1", dependencies=[Depends(_bearer)], responses={401: ERROR_RESPONSES[401]})

    @v1.get("/models", tags=["meta"], summary="Model sizes, content types and limits")
    async def models():
        return {
            "sizes": [{"id": s, "network": f"anime4k/cnn-2x-{SIZES[s]}", "description": SIZE_DESCRIPTIONS[s]} for s in SIZES],
            "default_size": "medium",
            "contents": [{"id": c, "description": CONTENT_DESCRIPTIONS[c]} for c in CONTENTS],
            "default_content": "rl",
            "native_scale": 2,
            "formats": ["png", "jpeg", "webp"],
            "limits": {
                "max_upload_bytes": settings.max_upload_bytes,
                "max_input_pixels": settings.max_input_pixels,
                "max_output_pixels": settings.max_output_pixels,
                "max_passes": min(MAX_PASSES, settings.max_passes),
                "max_queued_jobs": settings.max_queued_jobs,
                "rate_limit_per_minute": settings.rate_limit_per_minute,
                "job_ttl_seconds": settings.job_ttl_seconds,
                "max_edge_by_format": {k: v for k, v in FORMAT_MAX_EDGE.items() if v < 2**31 - 1},
            },
        }

    async def _read_params(
        file: Optional[UploadFile], model, content, passes, target_long_edge, fmt
    ):
        if file is None:
            raise ApiError(422, "missing_file", "Multipart field 'file' is required.")
        params = normalise_params(model, content, passes, target_long_edge, fmt, settings, file.filename)
        data = await file.read()
        if len(data) > settings.max_upload_bytes:
            raise ApiError(413, "payload_too_large", f"Upload exceeds the {settings.max_upload_bytes} byte limit.")
        if not data:
            raise ApiError(422, "invalid_image", "The uploaded file is empty.")
        return params, data

    def _run_sync(data: bytes, params: UpscaleParams) -> UpscaleResult:
        precheck(data, params, settings)
        if not gate.acquire(timeout=settings.sync_wait_seconds):
            raise ApiError(503, "busy", "The upscaler is busy; retry shortly or use /v1/jobs.", {"Retry-After": "10"})
        try:
            return run_upscale(data, params, settings)
        finally:
            gate.release()

    @v1.post(
        "/upscale",
        tags=["upscale"],
        summary="Upscale one image synchronously",
        response_class=Response,
        responses={
            200: {
                "description": "The upscaled image. Dimensions and passes are also in X-Upscale-* headers.",
                "content": {"image/png": {}, "image/jpeg": {}, "image/webp": {}},
            },
            **{k: ERROR_RESPONSES[k] for k in (413, 415, 422, 429, 503)},
        },
    )
    async def upscale(
        file: Optional[UploadFile] = File(None, description="PNG, JPEG or WebP (type is checked by decoding)."),
        model: Optional[str] = Form(None, description="small | medium | large (default medium)"),
        content: Optional[str] = Form(None, description="rl | an | 3d (default rl)"),
        passes: Optional[str] = Form(None, description="1-4 native 2x passes (default 1). Exclusive with target_long_edge."),
        target_long_edge: Optional[str] = Form(
            None, description="Wanted long edge in px; uses the fewest 2x passes that reach it. Never resamples."
        ),
        format: Optional[str] = Form(None, description="png | jpeg | webp (default: same as input)"),
    ):
        params, data = await _read_params(file, model, content, passes, target_long_edge, format)
        result = await run_in_threadpool(_run_sync, data, params)
        plan = result.plan
        headers = _result_headers(result)
        headers["Content-Disposition"] = f'attachment; filename="{output_filename(params.filename, plan)}"'
        return Response(content=result.data, media_type=result.mime, headers=headers)

    @v1.post(
        "/jobs",
        tags=["jobs"],
        summary="Queue an upscale job",
        status_code=202,
        responses={**{k: ERROR_RESPONSES[k] for k in (413, 415, 422, 429, 503)}},
    )
    async def create_job(
        request: Request,
        file: Optional[UploadFile] = File(None),
        model: Optional[str] = Form(None),
        content: Optional[str] = Form(None),
        passes: Optional[str] = Form(None),
        target_long_edge: Optional[str] = Form(None),
        format: Optional[str] = Form(None),
    ):
        params, data = await _read_params(file, model, content, passes, target_long_edge, format)
        rec = await run_in_threadpool(queue_.submit, request.state.key_id, params, data)
        return JSONResponse(
            {"id": rec.id, "status": rec.status},
            status_code=202,
            headers={"Location": f"/v1/jobs/{rec.id}"},
        )

    @v1.get("/jobs/{job_id}", tags=["jobs"], summary="Job status, progress and result metadata")
    async def get_job(job_id: str, request: Request):
        rec = queue_.get_for_owner(job_id, request.state.key_id)
        return _job_view(rec, settings.job_ttl_seconds)

    @v1.get(
        "/jobs/{job_id}/result",
        tags=["jobs"],
        summary="Download the finished image",
        response_class=FileResponse,
        responses={200: {"content": {"image/png": {}, "image/jpeg": {}, "image/webp": {}}}},
    )
    async def get_job_result(job_id: str, request: Request):
        rec = queue_.get_for_owner(job_id, request.state.key_id)
        if rec.status == FAILED:
            raise ApiError(409, "job_failed", (rec.error or {}).get("message", "The job failed."))
        if rec.status != SUCCEEDED or rec.result is None:
            raise ApiError(409, "job_not_ready", f"Job is {rec.status}.", {"Retry-After": "2"})
        path = store.result_path(job_id)
        if path is None:
            raise ApiError(404, "job_not_found", "The result is no longer available.")
        r = rec.result
        return FileResponse(
            path,
            media_type=r["mime"],
            headers={
                "X-Upscale-Width": str(r["width"]),
                "X-Upscale-Height": str(r["height"]),
                "X-Upscale-Passes": str(r["passes"]),
                "Content-Disposition": f'attachment; filename="{r["filename"]}"',
                "Cache-Control": "no-store",
            },
        )

    @v1.delete("/jobs/{job_id}", tags=["jobs"], summary="Delete a job and its image data now", status_code=204)
    async def delete_job(job_id: str, request: Request):
        rec = queue_.get_for_owner(job_id, request.state.key_id)
        if rec.status == "running":
            raise ApiError(409, "job_running", "A running job cannot be deleted yet.")
        queue_.delete(job_id)
        return Response(status_code=204)

    app.include_router(v1)
    return app
