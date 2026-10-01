# Build context: this directory (api/). Root directory on Railway: `api`.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    OMP_NUM_THREADS=4 \
    OPENBLAS_NUM_THREADS=4
# ^ BLAS thread cap: containers see the host's cores, not their CPU quota. Override in
#   the Railway variables to match the vCPUs you pay for.

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# weights/ is a copy of ../src/weights (scripts/sync_weights.py keeps it in step)
COPY app ./app
COPY weights ./weights

# Run as an unprivileged user; job results live under /tmp/upscaler-api-jobs.
RUN useradd --system --create-home --uid 10001 upscaler \
    && mkdir -p /tmp/upscaler-api-jobs \
    && chown -R upscaler:upscaler /tmp/upscaler-api-jobs
USER upscaler

# Railway injects PORT; 8080 is only the local default.
ENV PORT=8080
EXPOSE 8080

# One process on purpose: the job queue, results and rate limits live in memory.
CMD ["sh", "-c", "exec uvicorn app.asgi:app --host 0.0.0.0 --port ${PORT} --workers 1 --timeout-keep-alive 75"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os,sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/healthz' % os.environ.get('PORT','8080'), timeout=4).status == 200 else 1)"
