import threading
import time

import app.jobs as jobs
from app.errors import ApiError

from .conftest import KEY, KEY2
from .helpers import decode, png_bytes, upload

B2 = {"Authorization": f"Bearer {KEY2}"}


def wait_for(client, job_id, want, headers=None, timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/v1/jobs/{job_id}", headers=headers)
        assert r.status_code == 200, r.text
        if r.json()["status"] in want:
            return r.json()
        time.sleep(0.02)
    raise AssertionError(f"job {job_id} never reached {want}: {r.json()}")


def submit(client, data=None, **form):
    r = client.post("/v1/jobs", data=form or {"model": "small"}, files=upload(data or png_bytes(24, 16)))
    assert r.status_code == 202, r.text
    return r.json()


def test_job_lifecycle(client):
    created = submit(client, model="small", passes="2")
    assert set(created) == {"id", "status"} and created["status"] in ("queued", "running", "succeeded")
    done = wait_for(client, created["id"], {"succeeded"})
    assert done["progress"] == 1.0 and done["passes"] == 2 and done["error"] is None
    assert done["result"]["width"] == 96 and done["result"]["height"] == 64
    assert done["result"]["format"] == "png" and done["result"]["bytes"] > 0
    assert done["params"]["model"] == "small" and done["params"]["passes"] == 2
    assert done["created_at"].endswith("Z") and done["expires_at"] and done["finished_at"]

    r = client.get(f"/v1/jobs/{created['id']}/result")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png"
    assert decode(r.content).size == (96, 64)
    assert r.headers["X-Upscale-Width"] == "96" and "upscaled_96x64.png" in r.headers["content-disposition"]
    assert len(r.content) == done["result"]["bytes"]


def test_job_location_header_and_ids_are_unguessable(client):
    r = client.post("/v1/jobs", data={"model": "small"}, files=upload(png_bytes(8, 8)))
    jid = r.json()["id"]
    assert r.headers["location"] == f"/v1/jobs/{jid}"
    assert len(jid) >= 20
    assert jid != submit(client)["id"]


def test_job_target_long_edge_and_format(client):
    # long edge 24: 48, 96 are below 100 -> 3 passes -> 192x128
    j = submit(client, model="small", target_long_edge="100", format="webp")
    done = wait_for(client, j["id"], {"succeeded"})
    assert (done["result"]["width"], done["result"]["height"]) == (192, 128)
    assert done["result"]["passes"] == 3 and done["result"]["mime"] == "image/webp"
    assert decode(client.get(f"/v1/jobs/{j['id']}/result").content).format == "WEBP"


def test_jobs_are_private_to_the_key_that_created_them(client):
    j = submit(client)
    wait_for(client, j["id"], {"succeeded"})
    for method, path in (("GET", f"/v1/jobs/{j['id']}"), ("GET", f"/v1/jobs/{j['id']}/result"), ("DELETE", f"/v1/jobs/{j['id']}")):
        r = client.request(method, path, headers=B2)
        assert r.status_code == 404 and r.json()["error"]["code"] == "job_not_found", (method, path)
    # indistinguishable from a job that never existed
    assert client.get("/v1/jobs/job_unknown", headers=B2).json() == client.get(f"/v1/jobs/{j['id']}", headers=B2).json()
    # and the owner still has it
    assert client.get(f"/v1/jobs/{j['id']}").status_code == 200
    assert client.get(f"/v1/jobs/{j['id']}/result").status_code == 200


def test_result_before_completion_is_409(client, monkeypatch):
    gate = threading.Event()
    real = jobs.run_upscale

    def slow(*a, **k):
        gate.wait(10)
        return real(*a, **k)

    monkeypatch.setattr(jobs, "run_upscale", slow)
    j = submit(client)
    wait_for(client, j["id"], {"running"})
    r = client.get(f"/v1/jobs/{j['id']}/result")
    assert r.status_code == 409 and r.json()["error"]["code"] == "job_not_ready"
    assert client.delete(f"/v1/jobs/{j['id']}").json()["error"]["code"] == "job_running"
    gate.set()
    wait_for(client, j["id"], {"succeeded"})


def test_failed_job_reports_error_without_internals(client, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("disk exploded at /secret/path")

    monkeypatch.setattr(jobs, "run_upscale", boom)
    j = submit(client)
    done = wait_for(client, j["id"], {"failed"})
    assert done["error"] == {"code": "internal_error", "message": "The job failed unexpectedly."}
    assert done["result"] is None
    r = client.get(f"/v1/jobs/{j['id']}/result")
    assert r.status_code == 409 and r.json()["error"]["code"] == "job_failed"
    assert "secret" not in r.text and "secret" not in str(done)


def test_failed_job_with_api_error_keeps_its_code(client, monkeypatch):
    def refuse(*a, **k):
        raise ApiError(422, "invalid_image", "The upload is not a valid, complete PNG, JPEG or WebP image.")

    monkeypatch.setattr(jobs, "run_upscale", refuse)
    done = wait_for(client, submit(client)["id"], {"failed"})
    assert done["error"]["code"] == "invalid_image"


def test_single_worker_runs_jobs_one_at_a_time_in_order(client, monkeypatch):
    real = jobs.run_upscale
    active, peak, order = [0], [0], []
    lock = threading.Lock()

    def tracked(data, params, settings, progress=None, plan=None):
        with lock:
            active[0] += 1
            peak[0] = max(peak[0], active[0])
        try:
            time.sleep(0.05)
            order.append(params.model)
            return real(data, params, settings, progress)
        finally:
            with lock:
                active[0] -= 1

    monkeypatch.setattr(jobs, "run_upscale", tracked)
    ids = [submit(client, model=m)["id"] for m in ("small", "medium", "large", "small")]
    for i in ids:
        wait_for(client, i, {"succeeded"})
    assert peak[0] == 1 and order == ["small", "medium", "large", "small"]


def test_progress_is_reported(client, monkeypatch):
    seen = []
    real = jobs.run_upscale

    def spy(data, params, settings, progress=None, plan=None):
        def wrapped(f, p, n):
            seen.append((round(f, 3), p, n))
            if progress:
                progress(f, p, n)

        return real(data, params, settings, wrapped)

    monkeypatch.setattr(jobs, "run_upscale", spy)
    wait_for(client, submit(client, model="small", passes="3")["id"], {"succeeded"})
    fractions = [f for f, _, _ in seen]
    assert fractions == sorted(fractions) and fractions[-1] == 1.0
    assert {p for _, p, _ in seen} == {1, 2, 3}


def test_queue_limit(make_client, monkeypatch):
    c = make_client(max_queued_jobs=1)
    gate = threading.Event()
    real = jobs.run_upscale

    def slow(*a, **k):
        gate.wait(10)
        return real(*a, **k)

    monkeypatch.setattr(jobs, "run_upscale", slow)
    first = submit(c)
    wait_for(c, first["id"], {"running"})  # leaves the queue
    submit(c)  # fills the single queue slot
    r = c.post("/v1/jobs", data={"model": "small"}, files=upload(png_bytes(8, 8)))
    assert r.status_code == 503 and r.json()["error"]["code"] == "queue_full" and "retry-after" in r.headers
    gate.set()


def test_results_expire_after_ttl_and_files_are_removed(client):
    j = submit(client)
    wait_for(client, j["id"], {"succeeded"})
    q = client.app.state.queue
    job_dir = q.store._dir(j["id"])
    assert job_dir.exists() and (job_dir / "result.bin").exists() and not (job_dir / "input.bin").exists()
    assert q.sweep() == []  # nothing is old yet
    q._clock = lambda: time.time() + 10_000
    assert q.sweep() == [j["id"]]
    assert not job_dir.exists()
    assert client.get(f"/v1/jobs/{j['id']}").status_code == 404
    assert client.get(f"/v1/jobs/{j['id']}/result").status_code == 404


def test_delete_removes_the_job(client):
    j = submit(client)
    wait_for(client, j["id"], {"succeeded"})
    assert client.delete(f"/v1/jobs/{j['id']}").status_code == 204
    assert client.get(f"/v1/jobs/{j['id']}").status_code == 404


def test_startup_clears_orphaned_payloads(tmp_path):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from .conftest import make_settings

    s = make_settings(tmp_path)
    orphan = s.job_dir / "job_orphan"
    orphan.mkdir(parents=True)
    (orphan / "input.bin").write_bytes(b"left over from a crash")
    with TestClient(create_app(s)):
        assert not orphan.exists()


def test_store_is_swappable(tmp_path):
    """The queue only needs the JobStore interface."""
    import abc

    required = {n for n in dir(jobs.JobStore) if getattr(getattr(jobs.JobStore, n), "__isabstractmethod__", False)}
    assert required == {
        "create", "get", "update", "read_input", "drop_input", "write_result",
        "result_path", "count", "expire", "delete", "clear",
    }
    assert isinstance(jobs.LocalJobStore(tmp_path), jobs.JobStore)
    assert issubclass(jobs.JobStore, abc.ABC)
