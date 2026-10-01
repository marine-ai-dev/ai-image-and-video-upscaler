"""Background jobs: a store interface, a local-disk implementation and a
single-worker in-process queue.

``JobStore`` is the seam for swapping in Redis (records) + a bucket (payloads);
the queue and the HTTP layer only talk to the interface.
"""
from __future__ import annotations

import abc
import logging
import queue
import secrets
import shutil
import threading
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .config import Settings
from .errors import ApiError
from .imageio import decode_image
from .service import EngineGate, UpscaleParams, UpscaleResult, output_filename, precheck, run_upscale

log = logging.getLogger("upscaler.jobs")

QUEUED, RUNNING, SUCCEEDED, FAILED = "queued", "running", "succeeded", "failed"


@dataclass
class JobRecord:
    id: str
    owner: str  # key id of the API key that created it
    status: str
    params: Dict[str, Any]
    created_at: float
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    progress: float = 0.0
    pass_no: int = 0
    passes: int = 0
    error: Optional[Dict[str, str]] = None
    result: Optional[Dict[str, Any]] = None


class JobStore(abc.ABC):
    """Persistence for job records and payload bytes."""

    @abc.abstractmethod
    def create(self, record: JobRecord, input_bytes: bytes) -> None: ...

    @abc.abstractmethod
    def get(self, job_id: str) -> Optional[JobRecord]: ...

    @abc.abstractmethod
    def update(self, job_id: str, **fields: Any) -> Optional[JobRecord]: ...

    @abc.abstractmethod
    def read_input(self, job_id: str) -> bytes: ...

    @abc.abstractmethod
    def drop_input(self, job_id: str) -> None: ...

    @abc.abstractmethod
    def write_result(self, job_id: str, data: bytes) -> None: ...

    @abc.abstractmethod
    def result_path(self, job_id: str) -> Optional[Path]:
        """Path to stream the result from (a bucket-backed store would download to a
        temp file or return a redirect instead)."""

    @abc.abstractmethod
    def delete(self, job_id: str) -> None: ...

    @abc.abstractmethod
    def count(self, status: str) -> int: ...

    @abc.abstractmethod
    def expire(self, older_than: float) -> List[str]:
        """Delete finished/queued jobs whose last activity is before ``older_than``."""

    @abc.abstractmethod
    def clear(self) -> None: ...


class LocalJobStore(JobStore):
    """Records in memory, payloads under ``root/<job id>/``."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self._records: Dict[str, JobRecord] = {}
        self._lock = threading.Lock()

    def _dir(self, job_id: str) -> Path:
        return self.root / job_id

    def create(self, record: JobRecord, input_bytes: bytes) -> None:
        d = self._dir(record.id)
        d.mkdir(parents=True, exist_ok=False)
        (d / "input.bin").write_bytes(input_bytes)
        with self._lock:
            self._records[record.id] = record

    def get(self, job_id: str) -> Optional[JobRecord]:
        with self._lock:
            rec = self._records.get(job_id)
            return JobRecord(**asdict(rec)) if rec else None

    def update(self, job_id: str, **fields: Any) -> Optional[JobRecord]:
        with self._lock:
            rec = self._records.get(job_id)
            if rec is None:
                return None
            for k, v in fields.items():
                setattr(rec, k, v)
            return JobRecord(**asdict(rec))

    def read_input(self, job_id: str) -> bytes:
        return (self._dir(job_id) / "input.bin").read_bytes()

    def drop_input(self, job_id: str) -> None:
        try:
            (self._dir(job_id) / "input.bin").unlink()
        except FileNotFoundError:
            pass

    def write_result(self, job_id: str, data: bytes) -> None:
        tmp = self._dir(job_id) / "result.tmp"
        tmp.write_bytes(data)
        tmp.replace(self._dir(job_id) / "result.bin")

    def result_path(self, job_id: str) -> Optional[Path]:
        p = self._dir(job_id) / "result.bin"
        return p if p.exists() else None

    def delete(self, job_id: str) -> None:
        with self._lock:
            self._records.pop(job_id, None)
        shutil.rmtree(self._dir(job_id), ignore_errors=True)

    def count(self, status: str) -> int:
        with self._lock:
            return sum(1 for r in self._records.values() if r.status == status)

    def expire(self, older_than: float) -> List[str]:
        with self._lock:
            doomed = [
                jid
                for jid, r in self._records.items()
                if r.status != RUNNING and (r.finished_at or r.created_at) < older_than
            ]
            for jid in doomed:
                del self._records[jid]
        for jid in doomed:
            shutil.rmtree(self._dir(jid), ignore_errors=True)
        return doomed

    def clear(self) -> None:
        with self._lock:
            self._records.clear()
        if self.root.exists():
            for child in self.root.iterdir():
                shutil.rmtree(child, ignore_errors=True)


class JobQueue:
    """Single worker thread draining an in-process FIFO."""

    def __init__(self, store: JobStore, settings: Settings, gate: EngineGate, clock: Callable[[], float] = time.time):
        self.store = store
        self.settings = settings
        self.gate = gate
        self._clock = clock
        self._q: "queue.Queue[Optional[str]]" = queue.Queue()
        self._stop = threading.Event()
        self._worker: Optional[threading.Thread] = None
        self._janitor: Optional[threading.Thread] = None
        self._submit_lock = threading.Lock()

    # -- lifecycle ----------------------------------------------------------------
    def start(self) -> None:
        self.store.clear()  # records are in memory only; orphaned payloads are useless
        self._worker = threading.Thread(target=self._run, name="job-worker", daemon=True)
        self._janitor = threading.Thread(target=self._sweep_loop, name="job-janitor", daemon=True)
        self._worker.start()
        self._janitor.start()

    def stop(self) -> None:
        self._stop.set()
        self._q.put(None)
        if self._worker:
            self._worker.join(timeout=5)

    # -- submission ---------------------------------------------------------------
    def submit(self, owner: str, params: UpscaleParams, data: bytes) -> JobRecord:
        plan = precheck(data, params, self.settings)  # cheap, rejects before queueing
        decode_image(data, self.settings.max_input_pixels)  # truncated/corrupt files fail now, not later
        with self._submit_lock:
            if self.store.count(QUEUED) >= self.settings.max_queued_jobs:
                raise ApiError(
                    503, "queue_full", "The job queue is full; try again shortly.", {"Retry-After": "30"}
                )
            job_id = "job_" + secrets.token_urlsafe(16)
            record = JobRecord(
                id=job_id,
                owner=owner,
                status=QUEUED,
                params={
                    "model": plan.model,
                    "content": plan.content,
                    "passes": plan.passes,
                    "format": plan.format,
                    "source_width": plan.source_width,
                    "source_height": plan.source_height,
                    "width": plan.width,
                    "height": plan.height,
                    "filename": params.filename,
                },
                created_at=self._clock(),
                passes=plan.passes,
            )
            self.store.create(record, data)
        self._q.put(job_id)
        return self.store.get(job_id) or record

    def get_for_owner(self, job_id: str, owner: str) -> JobRecord:
        rec = self.store.get(job_id)
        if rec is None or rec.owner != owner:
            raise ApiError(404, "job_not_found", "No such job.")
        return rec

    def delete(self, job_id: str) -> None:
        self.store.delete(job_id)

    # -- worker -------------------------------------------------------------------
    def _run(self) -> None:
        while not self._stop.is_set():
            job_id = self._q.get()
            if job_id is None:
                break
            try:
                self._execute(job_id)
            except Exception:  # never let the worker die
                log.exception("job worker crashed on %s", job_id)

    def _execute(self, job_id: str) -> None:
        rec = self.store.get(job_id)
        if rec is None:  # expired while queued
            return
        p = rec.params  # the stored record is self-describing; the worker needs nothing else
        params = UpscaleParams(
            model=p["model"], content=p["content"], passes=p["passes"], format=p["format"], filename=p.get("filename")
        )
        self.gate.acquire(None)
        try:
            self.store.update(job_id, status=RUNNING, started_at=self._clock())
            try:
                data = self.store.read_input(job_id)

                def progress(fraction: float, pass_no: int, passes: int) -> None:
                    self.store.update(job_id, progress=round(fraction, 4), pass_no=pass_no, passes=passes)

                result = run_upscale(data, params, self.settings, progress)
                self.store.write_result(job_id, result.data)
                self.store.update(
                    job_id,
                    status=SUCCEEDED,
                    progress=1.0,
                    finished_at=self._clock(),
                    result=self._result_meta(job_id, result, params),
                )
            except ApiError as exc:
                self.store.update(
                    job_id, status=FAILED, finished_at=self._clock(), error={"code": exc.code, "message": exc.message}
                )
            except Exception as exc:
                log.error("job %s failed: %s", job_id, type(exc).__name__)
                self.store.update(
                    job_id,
                    status=FAILED,
                    finished_at=self._clock(),
                    error={"code": "internal_error", "message": "The job failed unexpectedly."},
                )
            finally:
                self.store.drop_input(job_id)
        finally:
            self.gate.release()

    @staticmethod
    def _result_meta(job_id: str, result: UpscaleResult, params: UpscaleParams) -> Dict[str, Any]:
        return {
            "width": result.width,
            "height": result.height,
            "passes": result.passes,
            "format": result.format,
            "mime": result.mime,
            "bytes": len(result.data),
            "filename": output_filename(params.filename, result.plan),
            "url": f"/v1/jobs/{job_id}/result",
        }

    # -- cleanup ------------------------------------------------------------------
    def sweep(self) -> List[str]:
        return self.store.expire(self._clock() - self.settings.job_ttl_seconds)

    def _sweep_loop(self) -> None:
        interval = max(1.0, min(60.0, self.settings.job_ttl_seconds / 4))
        while not self._stop.wait(interval):
            try:
                self.sweep()
            except Exception:
                log.exception("job sweep failed")
