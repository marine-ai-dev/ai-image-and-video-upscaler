/**
 * Type-safe worker message definitions for communication between
 * the main thread and the video processing worker.
 */

import type { Msg } from '../lib/i18n';

export interface Resolution {
  width: number;
  height: number;
}

/** Real GPU limits, reported once at startup and used for safety checks. */
export interface DeviceCapabilities {
  maxTextureDimension: number;
  maxStorageBufferBindingSize: number;
}

/**
 * Which network to run. Weights are registered separately (see
 * `registerWeights`) and referenced by key so large JSON payloads are only
 * transferred to the worker once.
 */
export interface NetworkSelection {
  name: string;
  weightsKey: string;
}

export interface PassOptions extends NetworkSelection {
  /** Number of successive native model passes (each pass is 2x). */
  passes: number;
}

// Messages sent FROM main thread TO worker
export type WorkerRequestMessage =
  | { cmd: 'isSupported' }
  | { cmd: 'init'; data: InitData }
  | { cmd: 'network'; data: NetworkData }
  | { cmd: 'registerWeights'; data: { key: string; weights: any } }
  | { cmd: 'processImage'; data: ImageProcessData }
  | { cmd: 'process'; inputHandle: FileSystemFileHandle; outputHandle?: FileSystemFileHandle; options?: PassOptions }
  | { cmd: 'imageJob'; data: ImageJobData }
  | { cmd: 'videoJob'; data: VideoJobData }
  | { cmd: 'cancel' }
  /** Clears a previous cancellation so new work can start. */
  | { cmd: 'resetCancel' }
  | { cmd: 'releaseCache' }
  | { cmd: 'gpuStats' };

export interface InitData {
  bitmap: ImageBitmap;
  /**
   * Only sent on the first load of a page: a canvas can be transferred to the
   * worker once, so later loads reuse the ones the worker already holds.
   */
  upscaled?: OffscreenCanvas;
  original?: OffscreenCanvas;
  resolution: Resolution;
  preserveAlpha?: boolean;
}

export interface NetworkData {
  name: string;
  bitmap: ImageBitmap;
  weights: any; // WebSR weight JSON
  preserveAlpha?: boolean;
}

export interface ImageProcessData {
  bitmap: ImageBitmap;
  mimeType: string;
  /** Optional multi-pass config; absent or 1 keeps the original single-pass path. */
  options?: PassOptions;
}

/** A batch image job: fully self-contained, identified by jobId. */
export interface ImageJobData extends PassOptions {
  jobId: string;
  bitmap: ImageBitmap;
  mimeType: string;
  preserveAlpha?: boolean;
}

/**
 * A batch video job. The main thread resolves the file up front (the worker
 * only ever needed the File, and a File clones cleanly across threads).
 * Output is streamed into `outputHandle` when one is provided.
 */
export interface VideoJobData extends PassOptions {
  jobId: string;
  input: File;
  outputHandle?: FileSystemFileHandle;
}

// Messages sent FROM worker TO main thread
export type WorkerResponseMessage =
  | { cmd: 'isSupported'; data: boolean; caps?: DeviceCapabilities }
  | { cmd: 'progress'; data: number }
  | { cmd: 'eta'; data: string }
  | { cmd: 'pass'; data: { pass: number; passes: number; width: number; height: number } }
  | { cmd: 'process' }
  | { cmd: 'error'; data: Msg }
  | { cmd: 'finishedImage'; data: ArrayBuffer; mimeType: string; width?: number; height?: number }
  | { cmd: 'finished'; data: ArrayBuffer | null }
  | { cmd: 'jobProgress'; jobId: string; pass: number; passes: number; percent: number }
  | { cmd: 'jobDone'; jobId: string; data: ArrayBuffer | null; mimeType: string; width: number; height: number }
  | { cmd: 'jobError'; jobId: string; message: Msg; cancelled?: boolean }
  /** Measured GPU cost of a network, used for realistic memory predictions. */
  | { cmd: 'networkProfile'; data: { name: string; bytesPerInputPixel: number } }
  /** Snapshot of the worker's GPU instance cache (diagnostics/tests). */
  | { cmd: 'gpuStats'; data: { instances: number; bytes: number; keys: string[] } };

// Type guard helpers
export function isWorkerRequestMessage(msg: any): msg is WorkerRequestMessage {
  return msg && typeof msg.cmd === 'string';
}

export function isWorkerResponseMessage(msg: any): msg is WorkerResponseMessage {
  return msg && typeof msg.cmd === 'string';
}
