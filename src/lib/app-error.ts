import { Msg } from './i18n';

/**
 * An error whose message is a translation key rather than English prose, so
 * failures raised deep in the pipeline can still be shown in the user's
 * language. `message` keeps a readable form for the console and for `catch`
 * blocks that only log.
 */
export class AppError extends Error {
    readonly msg: Msg;

    constructor(key: string, params?: Record<string, string | number>) {
        super(params ? `${key} ${JSON.stringify(params)}` : key);
        this.name = 'AppError';
        this.msg = params ? { key, params } : { key };
    }
}

/** Turn any thrown value into a Msg, preserving keys where we have them. */
export function toMsg(error: unknown): Msg {
    if (error instanceof AppError) return error.msg;
    const text = (error as any)?.message || String(error);
    return { key: 'error.raw', params: { reason: text } };
}
