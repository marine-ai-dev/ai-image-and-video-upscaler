/**
 * Promise-shaped access to the existing processing worker.
 *
 * The worker stays the single owner of the GPU and the WebSR instances; this
 * bridge only correlates request/response pairs by jobId so the batch
 * controller can `await` a file. Messages that do not belong to a job are
 * handed back to the existing single-file message handler untouched.
 */

import type { WorkerResponseMessage, PassOptions } from '../types/worker-messages';

export interface JobResult {
    data: ArrayBuffer | null;
    mimeType: string;
    width: number;
    height: number;
}

export interface JobProgress {
    pass: number;
    passes: number;
    percent: number;
}

interface PendingJob {
    resolve: (result: JobResult) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: JobProgress) => void;
}

export class CancelledError extends Error {
    constructor() {
        super('Cancelled');
        this.name = 'CancelledError';
    }
}

export class WorkerBridge {
    private pending = new Map<string, PendingJob>();
    private registeredWeights = new Set<string>();
    private counter = 0;

    constructor(private worker: Worker) { }

    nextJobId(prefix: string = 'job'): string {
        this.counter++;
        return `${prefix}-${this.counter}`;
    }

    /** Send a weight set once; later jobs refer to it by key. */
    registerWeights(key: string, weights: any): void {
        if (this.registeredWeights.has(key)) return;
        this.worker.postMessage({ cmd: 'registerWeights', data: { key, weights } });
        this.registeredWeights.add(key);
    }

    runImageJob(
        jobId: string,
        bitmap: ImageBitmap,
        options: PassOptions & { mimeType: string; preserveAlpha?: boolean },
        onProgress?: (progress: JobProgress) => void
    ): Promise<JobResult> {
        return new Promise<JobResult>((resolve, reject) => {
            this.pending.set(jobId, { resolve, reject, onProgress });
            this.resetCancel();
            this.worker.postMessage({
                cmd: 'imageJob',
                data: {
                    jobId,
                    bitmap,
                    mimeType: options.mimeType,
                    preserveAlpha: options.preserveAlpha,
                    name: options.name,
                    weightsKey: options.weightsKey,
                    passes: options.passes
                }
            }, [bitmap]);
        });
    }

    runVideoJob(
        jobId: string,
        input: File,
        outputHandle: FileSystemFileHandle | undefined,
        options: PassOptions,
        onProgress?: (progress: JobProgress) => void
    ): Promise<JobResult> {
        return new Promise<JobResult>((resolve, reject) => {
            this.pending.set(jobId, { resolve, reject, onProgress });
            this.resetCancel();
            this.worker.postMessage({
                cmd: 'videoJob',
                data: {
                    jobId,
                    input,
                    outputHandle,
                    name: options.name,
                    weightsKey: options.weightsKey,
                    passes: options.passes
                }
            });
        });
    }

    /** Ask the worker to stop at the next safe point. */
    cancel(): void {
        this.worker.postMessage({ cmd: 'cancel' });
    }

    /**
     * Clear a previous cancellation. Sent before every new job so a cancelled
     * batch cannot leave the worker permanently refusing work.
     */
    resetCancel(): void {
        this.worker.postMessage({ cmd: 'resetCancel' });
    }

    releaseCache(): void {
        this.worker.postMessage({ cmd: 'releaseCache' });
    }

    /** Snapshot of the worker's GPU instance cache. */
    gpuStats(): Promise<{ instances: number; bytes: number; keys: string[] }> {
        return new Promise((resolve) => {
            this.statsWaiters.push(resolve);
            this.worker.postMessage({ cmd: 'gpuStats' });
        });
    }

    private statsWaiters: ((stats: { instances: number; bytes: number; keys: string[] }) => void)[] = [];

    /**
     * @returns true when the message belonged to a job and was consumed.
     */
    handleMessage(message: WorkerResponseMessage): boolean {
        if (message.cmd === 'jobProgress') {
            this.pending.get(message.jobId)?.onProgress?.({
                pass: message.pass,
                passes: message.passes,
                percent: message.percent
            });
            return true;
        }

        if (message.cmd === 'jobDone') {
            const job = this.pending.get(message.jobId);
            this.pending.delete(message.jobId);
            job?.resolve({
                data: message.data,
                mimeType: message.mimeType,
                width: message.width,
                height: message.height
            });
            return true;
        }

        if (message.cmd === 'gpuStats') {
            this.statsWaiters.shift()?.(message.data);
            return true;
        }

        if (message.cmd === 'jobError') {
            const job = this.pending.get(message.jobId);
            this.pending.delete(message.jobId);
            job?.reject(message.cancelled ? new CancelledError() : new Error(message.message));
            return true;
        }

        return false;
    }
}
