/**
 * Localisation core.
 *
 * Every user-visible string lives in src/locales/*. Code that runs away from
 * the DOM (worker, batch controller, planning maths) never builds English
 * sentences: it returns a `Msg` descriptor - a key plus parameters - and only
 * the UI layer turns that into text. That keeps one translation surface and
 * makes it impossible for an untranslated sentence to leak out of library code.
 */

import en from '../locales/en.json';
import uk from '../locales/uk.json';

export type Locale = 'en' | 'uk';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'uk'];
export const DEFAULT_LOCALE: Locale = 'en';

/** A translatable message: a key plus values to interpolate into it. */
export interface Msg {
    key: string;
    params?: Record<string, string | number>;
}

export function msg(key: string, params?: Record<string, string | number>): Msg {
    return params ? { key, params } : { key };
}

const dictionaries: Record<Locale, Record<string, string>> = { en, uk };

let current: Locale = DEFAULT_LOCALE;

export function setLocale(locale: Locale): void {
    current = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
    if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('lang', current);
    }
}

export function getLocale(): Locale {
    return current;
}

/**
 * Translate a key. Missing keys fall back to English and then to the key
 * itself, so a gap degrades to something visible rather than a blank UI.
 */
export function t(key: string, params?: Record<string, string | number>): string {
    const template = dictionaries[current][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
    return interpolate(template, params);
}

/** Translate a Msg descriptor produced by non-UI code. */
export function tm(message: Msg | string | undefined | null): string {
    if (!message) return '';
    if (typeof message === 'string') return message;
    return t(message.key, message.params);
}

export function tmAll(messages: (Msg | string)[] | undefined): string[] {
    return (messages || []).map(tm);
}

function interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (whole, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
    );
}

/**
 * Ukrainian needs three plural forms; English needs two. Callers pass a count
 * and a key stem, e.g. plural('batch.passes', 3) -> 'batch.passes.many'.
 */
export function plural(stem: string, count: number, params?: Record<string, string | number>): string {
    const suffix = current === 'uk' ? ukPluralForm(count) : (count === 1 ? 'one' : 'other');
    const merged = { count, ...(params || {}) };
    const key = `${stem}.${suffix}`;
    const dict = dictionaries[current];
    if (dict[key] === undefined && current === 'uk') {
        // Fall back within Ukrainian before falling back to English.
        return t(`${stem}.many`, merged);
    }
    return t(key, merged);
}

function ukPluralForm(count: number): 'one' | 'few' | 'many' {
    const n = Math.abs(Math.floor(count));
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'one';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
    return 'many';
}

/** Locale encoded in the URL path (/en/, /uk/), if any. */
export function localeFromPath(pathname: string): Locale | null {
    const match = /^\/(en|uk)(\/|$)/.exec(pathname);
    return match ? (match[1] as Locale) : null;
}

/** Best locale for a first-time visitor. */
export function detectLocale(stored: string | null, languages: readonly string[]): Locale {
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) return stored as Locale;
    for (const language of languages) {
        const base = language.slice(0, 2).toLowerCase();
        if (SUPPORTED_LOCALES.includes(base as Locale)) return base as Locale;
    }
    return DEFAULT_LOCALE;
}
