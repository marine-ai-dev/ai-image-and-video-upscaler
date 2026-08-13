import Alpine from 'alpinejs';
import ImageCompare from './lib/image-compare-viewer.min';
import WebSR from '@websr/websr';
import type { WorkerRequestMessage, WorkerResponseMessage } from './types/worker-messages';

import {
    Dimensions,
    MAX_PASSES,
    NATIVE_SCALE,
    UpscaleMode,
    UpscaleSettings,
    DeviceCaps,
    FALLBACK_DEVICE_CAPS,
    evaluateSafety,
    memoryBudgetFor,
    formatDimensions,
    passProgression,
    planForTarget,
    resolveFinalDimensions,
    resolvePasses
} from './lib/upscale-math';
import { classifyFile } from './lib/media-files';
import { BatchController, BatchItem } from './batch/controller';
import { WorkerBridge } from './batch/worker-bridge';

import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import "./index.css";
import "./lib/image-compare-viewer.min.css";

// Web Worker for video processing
const worker = new Worker(new URL('./worker.ts', import.meta.url));

// Canvas and video elements
let upscaled_canvas: HTMLCanvasElement;
let original_canvas: HTMLCanvasElement;
let video: HTMLVideoElement;

// Network selection
type NetworkSize = 'small' | 'medium' | 'large';
type ContentType = 'rl' | 'an' | '3d';

let size: NetworkSize = 'medium';
let content: ContentType = 'rl';

// Video data
let download_name: string;
let inputFileHandle: FileSystemFileHandle;
let gpu: any;
let websr: WebSR;
let inputKind: 'video' | 'image' = 'video';
let previewBitmap: ImageBitmap | null = null;
let imageMimeType: string = 'image/png';
let editImage: HTMLImageElement | null = null;
let editImageName = 'edited-image.png';

// Multi-pass settings for the single-file flow
let singleSettings: UpscaleSettings = { mode: 'passes', passes: 1, targetLongEdge: 4096 };
let deviceCaps: DeviceCaps = FALLBACK_DEVICE_CAPS;

// Working-memory ceiling for one job, and the GPU cost per input pixel as
// measured by the worker (falls back to a static estimate until it reports).
const memoryBudget = memoryBudgetFor((navigator as any).deviceMemory);
const networkProfiles = new Map<string, number>();

// Batch processing
let bridge: WorkerBridge;
let batch: BatchController;
let includeSubfolders = false;

// The preview canvases can only be handed to the worker once per page; after
// that the worker owns them and resizes them itself for each new file.
let previewCanvasesTransferred = false;
let imageCompareMounted = false;

/**
 * Canvases + sizing for a preview `init` message. After the first load the DOM
 * canvases are detached, so their size must not be touched here.
 */
function previewInitPayload(resolution: Dimensions) {
    if (previewCanvasesTransferred) {
        return { transfer: [] as Transferable[], canvases: {} as any };
    }

    upscaled_canvas.width = resolution.width * NATIVE_SCALE;
    upscaled_canvas.height = resolution.height * NATIVE_SCALE;
    original_canvas.width = resolution.width * NATIVE_SCALE;
    original_canvas.height = resolution.height * NATIVE_SCALE;

    const upscaled = upscaled_canvas.transferControlToOffscreen();
    const original = original_canvas.transferControlToOffscreen();
    previewCanvasesTransferred = true;

    return { transfer: [upscaled, original] as Transferable[], canvases: { upscaled, original } };
}

function mountImageCompare(): void {
    if (imageCompareMounted) return;
    new ImageCompare(document.getElementById('image-compare')).mount();
    imageCompareMounted = true;
}

const editFilters = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    sepia: 0,
};

// AI model weights for different network sizes and content types
type WeightsMap = {
    [K in NetworkSize]: {
        [C in ContentType]: any;
    };
};

const weights: WeightsMap = {
    'large': {
        'rl': require('./weights/cnn-2x-l-rl.json'),
        'an': require('./weights/cnn-2x-l-an.json'),
        '3d': require('./weights/cnn-2x-l-3d.json'),
    },
    'medium': {
        'rl': require('./weights/cnn-2x-m-rl.json'),
        'an': require('./weights/cnn-2x-m-an.json'),
        '3d': require('./weights/cnn-2x-m-3d.json'),
    },
    'small': {
        'rl': require('./weights/cnn-2x-s-rl.json'),
        'an': require('./weights/cnn-2x-s-an.json'),
        '3d': require('./weights/cnn-2x-s-3d.json'),
    }
};

// Network name mapping
const networks: Record<NetworkSize, { name: string }> = {
    'small': {
        name: "anime4k/cnn-2x-s",
    },
    'medium': {
        name: "anime4k/cnn-2x-m",
    },
    'large': {
        name: "anime4k/cnn-2x-l",
    }
};

// Declare global window functions for Alpine to call and File System Access API
declare global {
    interface Window {
        chooseFile: (e?: Event) => Promise<void>;
        initRecording: () => Promise<void>;
        fullScreenPreview: (e?: Event) => Promise<void>;
        switchNetworkSize: (el: HTMLInputElement) => Promise<void>;
        switchNetworkStyle: (el: HTMLInputElement) => Promise<void>;
        showSaveFilePicker: (options?: any) => Promise<FileSystemFileHandle>;
        showOpenFilePicker: (options?: any) => Promise<FileSystemFileHandle[]>;
        showDirectoryPicker: (options?: any) => Promise<FileSystemDirectoryHandle>;
        chooseFiles: () => Promise<void>;
        chooseFolder: () => Promise<void>;
        setUpscaleMode: (mode: UpscaleMode) => void;
        setPasses: (passes: number | string) => void;
        setTargetResolution: (value: number | string) => void;
        setIncludeSubfolders: (value: boolean) => void;
        setBatchMode: (mode: UpscaleMode) => void;
        setBatchPasses: (passes: number | string) => void;
        setBatchTarget: (value: number | string) => void;
        setItemOverride: (id: string, value: string) => void;
        removeBatchItem: (id: string) => void;
        setCreatePdf: (value: boolean) => void;
        setPdfQuality: (value: string) => void;
        setPdfName: (value: string) => void;
        chooseOutputFolder: () => Promise<void>;
        startBatch: () => Promise<void>;
        cancelBatch: () => void;
        resetBatch: () => void;
        setLanguage: (lang: Lang) => void;
        toggleTheme: () => void;
        setPage: (page: PageKey) => void;
        chooseEditImage: () => void;
        updateEditFilter: (name: string, value: string) => void;
        resetEditFilters: () => void;
        downloadEditedImage: () => void;
    }
}

type Lang = 'en' | 'uk';

const translations: Record<Lang, Record<string, string>> = {
    en: {
        'meta.title': 'Free AI tool for your tasks',
        'meta.description': 'Browser-only AI video upscaler. Free, fast, no installs. Your video stays on your device.',
        'meta.og_title': 'AI Video Upscaler',
        'meta.og_description': 'Browser-only AI video upscaler. Free, fast, no installs. Your video stays on your device.',
        'meta.twitter_title': 'AI Video Upscaler',
        'meta.twitter_description': 'Browser-only AI video upscaler. Free, fast, no installs. Your video stays on your device.',
        'brand.name': 'Image Editor by MarineAI',
        'brand.tagline': 'Free AI tool for your tasks',
        'hero.title': 'Free AI video upscaling tool',
        'hero.subtitle': 'Upscale videos with AI for free. No sign-ups or registation.',
        'hero.info': '<p>This is a simple browser tool for AI video upscaling. There is nothing to install and no account required. You select a video and your browser handles the AI processing and video encoding locally.</p><p>I built it because many popular tools are either paid and heavy, or open source but require a lot of setup. This tool is designed to be quick, free, and easy to use. It is based on my <a href="https://github.com/sb2702/websr" target="_blank">WebSR</a> SDK, which ports AI super‑resolution models like <a href="https://github.com/bloc97/Anime4K" target="_blank">Anime4K</a> and <a href="https://github.com/xinntao/Real-ESRGAN" target="_blank">Real‑ESRGAN</a> to WebGPU.</p>',
        'unsupported.pre': 'Your browser does not support',
        'unsupported.post': ', a required browser feature for this tool.',
        'unsupported.try': 'Try the latest version of',
        'unsupported.chrome': 'Chrome',
        'unsupported.or': 'or',
        'unsupported.edge': 'Edge',
        'unsupported.device': 'on a laptop or desktop.',
        'unsupported.link': 'For reference, here\'s how it should work',
        'error.prefix': 'An error occurred while processing the video:',
        'file.choose_title': 'Choose a video or image to upscale',
        'file.choose_button': 'Single file',
        'input.multiple': 'Multiple files',
        'input.folder': 'Folder',
        'input.include_subfolders': 'Include subfolders (folder mode)',
        'input.hint': 'Supported: PNG, JPG, WebP images and MP4/MOV video. Everything is processed locally.',
        'upscale.mode': 'Upscale mode',
        'upscale.mode_passes': 'Number of passes',
        'upscale.mode_target': 'Target resolution',
        'upscale.passes': 'Passes',
        'upscale.target': 'Target long edge (px)',
        'upscale.target_hint': 'Aspect ratio is always preserved.',
        'upscale.progression': 'Expected progression',
        'upscale.final': 'Final expected resolution:',
        'batch.title': 'Batch queue',
        'batch.detected': 'Files detected:',
        'batch.images': 'Images:',
        'batch.videos': 'Videos:',
        'batch.ignored': 'Ignored:',
        'batch.start_over': 'Start over',
        'batch.skipped_title': 'Ignored files',
        'batch.apply_all': 'Apply to all',
        'batch.output': 'Output folder',
        'batch.choose_output': 'Choose…',
        'batch.pdf': 'PDF',
        'batch.pdf_create': 'Create PDF from processed images',
        'batch.pdf_max': 'Maximum',
        'batch.pdf_balanced': 'Balanced',
        'batch.col_file': 'File',
        'batch.col_type': 'Type',
        'batch.col_source': 'Original',
        'batch.col_passes': 'Passes',
        'batch.col_expected': 'Expected output',
        'batch.col_status': 'Status',
        'batch.files_processed': 'files processed',
        'batch.successful': 'successful',
        'batch.failed': 'failed',
        'batch.cancelled': 'cancelled',
        'batch.saved_to': 'Saved to:',
        'batch.pdf_created': 'PDF:',
        'batch.log': 'Processing log',
        'batch.process': 'PROCESS BATCH',
        'batch.cancel': 'Cancel batch',
        'preview.upscaling': 'Upscaling',
        'preview.to': 'to',
        'preview.input_size': 'Input size:',
        'preview.output_size': 'Output size:',
        'settings.network': 'Upscaling network',
        'settings.small': 'Small',
        'settings.medium': 'Medium',
        'settings.large': 'Large',
        'settings.tooltip': 'Small is faster, Large is slower but gives the most quality improvement',
        'action.choose_output': 'Choose output location',
        'action.start_upscaling': 'Start upscaling',
        'action.back': 'Back',
        'processing.prefix': 'Upscaling',
        'processing.eta': 'Estimated time left:',
        'complete.note': 'If you like the tool, please consider starring the project on GitHub.',
        'complete.saved': 'Saved result to',
        'complete.upscale_another': 'Upscale another',
        'complete.download': 'Download',
        'footer.source': '',
        'footer.copyright': '© 2026',
        'footer.contact': 'Contact',
        'ads.label': 'Sponsored',
        'ads.placeholder': 'Ad space (Google AdSense)',
        'edit.title': 'Edit images',
        'edit.subtitle': 'Upload an image, apply filters, and download it.',
        'edit.upload': 'Upload image',
        'edit.brightness': 'Brightness',
        'edit.contrast': 'Contrast',
        'edit.saturation': 'Saturation',
        'edit.blur': 'Blur',
        'edit.sepia': 'Sepia',
        'edit.reset': 'Reset',
        'edit.download': 'Download edited image',
    },
    uk: {
        'meta.title': 'Free AI tool for your tasks',
        'meta.description': 'Браузерний AI-апскейлер відео. Безкоштовно, швидко, без інсталяцій. Відео залишається на вашому пристрої.',
        'meta.og_title': 'AI-апскейлер відео',
        'meta.og_description': 'Браузерний AI-апскейлер відео. Безкоштовно, швидко, без інсталяцій. Відео залишається на вашому пристрої.',
        'meta.twitter_title': 'AI-апскейлер відео',
        'meta.twitter_description': 'Браузерний AI-апскейлер відео. Безкоштовно, швидко, без інсталяцій. Відео залишається на вашому пристрої.',
        'brand.name': 'Image Editor by MarineAI',
        'brand.tagline': 'Безкоштовний AI-інструмент для ваших завдань',
        'hero.title': 'Безкоштовний AI-інструмент для апскейлінгу відео',
        'hero.subtitle': 'Покращуйте відео за допомогою AI безкоштовно. Без інсталяцій і реєстрації. Усе працює локально у вашому браузері.',
        'hero.info': '<p>Це простий браузерний інструмент для AI-апскейлінгу відео. Нічого встановлювати не потрібно, акаунт також не потрібен. Ви вибираєте відео, а браузер локально виконує обробку та кодування.</p><p>Я створив його, бо багато популярних інструментів або платні й складні, або з відкритим кодом, але потребують налаштувань. Цей інструмент — швидкий, безкоштовний і простий. Він базується на моєму SDK <a href="https://github.com/sb2702/websr" target="_blank">WebSR</a>, який переносить моделі супер‑роздільної здатності, такі як <a href="https://github.com/bloc97/Anime4K" target="_blank">Anime4K</a> та <a href="https://github.com/xinntao/Real-ESRGAN" target="_blank">Real‑ESRGAN</a>, у WebGPU.</p>',
        'unsupported.pre': 'Ваш браузер не підтримує',
        'unsupported.post': '— необхідну функцію для цього інструмента.',
        'unsupported.try': 'Спробуйте останню версію',
        'unsupported.chrome': 'Chrome',
        'unsupported.or': 'або',
        'unsupported.edge': 'Edge',
        'unsupported.device': 'на ноутбуці або настільному ПК.',
        'unsupported.link': 'Для наочності — ось як це має працювати',
        'error.prefix': 'Сталася помилка під час обробки відео:',
        'file.choose_title': 'Оберіть відео або зображення для апскейлу',
        'file.choose_button': 'Один файл',
        'input.multiple': 'Кілька файлів',
        'input.folder': 'Тека',
        'input.include_subfolders': 'Включати підтеки (режим теки)',
        'input.hint': 'Підтримуються: PNG, JPG, WebP та відео MP4/MOV. Усе обробляється локально.',
        'upscale.mode': 'Режим апскейлу',
        'upscale.mode_passes': 'Кількість проходів',
        'upscale.mode_target': 'Цільова роздільність',
        'upscale.passes': 'Проходи',
        'upscale.target': 'Цільова довга сторона (px)',
        'upscale.target_hint': 'Співвідношення сторін завжди зберігається.',
        'upscale.progression': 'Очікувана послідовність',
        'upscale.final': 'Очікувана фінальна роздільність:',
        'batch.title': 'Черга обробки',
        'batch.detected': 'Знайдено файлів:',
        'batch.images': 'Зображення:',
        'batch.videos': 'Відео:',
        'batch.ignored': 'Пропущено:',
        'batch.start_over': 'Почати спочатку',
        'batch.skipped_title': 'Пропущені файли',
        'batch.apply_all': 'Застосувати до всіх',
        'batch.output': 'Тека для результатів',
        'batch.choose_output': 'Обрати…',
        'batch.pdf': 'PDF',
        'batch.pdf_create': 'Створити PDF з оброблених зображень',
        'batch.pdf_max': 'Максимальна',
        'batch.pdf_balanced': 'Збалансована',
        'batch.col_file': 'Файл',
        'batch.col_type': 'Тип',
        'batch.col_source': 'Оригінал',
        'batch.col_passes': 'Проходи',
        'batch.col_expected': 'Очікуваний результат',
        'batch.col_status': 'Статус',
        'batch.files_processed': 'файлів оброблено',
        'batch.successful': 'успішно',
        'batch.failed': 'з помилкою',
        'batch.cancelled': 'скасовано',
        'batch.saved_to': 'Збережено у:',
        'batch.pdf_created': 'PDF:',
        'batch.log': 'Журнал обробки',
        'batch.process': 'ОБРОБИТИ ПАКЕТ',
        'batch.cancel': 'Скасувати пакет',
        'preview.upscaling': 'Апскейлінг',
        'preview.to': 'до',
        'preview.input_size': 'Вхідний розмір:',
        'preview.output_size': 'Вихідний розмір:',
        'settings.network': 'Мережа апскейлінгу',
        'settings.small': 'Мала',
        'settings.medium': 'Середня',
        'settings.large': 'Велика',
        'settings.tooltip': 'Мала — швидша, велика — повільніша, але з кращою якістю',
        'action.choose_output': 'Оберіть місце збереження',
        'action.start_upscaling': 'Почати апскейлінг',
        'action.back': 'Назад',
        'processing.prefix': 'Апскейлінг',
        'processing.eta': 'Орієнтовний час:',
        'complete.note': 'Якщо вам сподобався інструмент, підтримайте проєкт зіркою на GitHub.',
        'complete.saved': 'Результат збережено у',
        'complete.upscale_another': 'Апскейлити ще одне',
        'complete.download': 'Завантажити',
        'footer.source': '',
        'footer.copyright': '© 2026',
        'footer.contact': 'Контакт',
        'ads.label': 'Реклама',
        'ads.placeholder': 'Місце для реклами (Google AdSense)',
        'edit.title': 'Редагувати зображення',
        'edit.subtitle': 'Завантажте зображення, застосуйте фільтри та завантажте результат.',
        'edit.upload': 'Завантажити зображення',
        'edit.brightness': 'Яскравість',
        'edit.contrast': 'Контраст',
        'edit.saturation': 'Насиченість',
        'edit.blur': 'Розмиття',
        'edit.sepia': 'Сепія',
        'edit.reset': 'Скинути',
        'edit.download': 'Завантажити зображення',
    }
};

const supportedLangs: Lang[] = ['en', 'uk'];
let currentLang: Lang = 'en';
type ThemeMode = 'light' | 'dark';
let currentTheme: ThemeMode = 'light';
type PageKey = 'home' | 'upscaler' | 'filters';

document.addEventListener("DOMContentLoaded", index);

//===================  Initial Load ===========================

/**
 * Main initialization function called on page load
 */
async function index(): Promise<void> {
    Alpine.store('state', 'init');
    Alpine.store('networkSizeLabel', 'Medium');
    Alpine.store('page', 'upscaler');

    // Multi-pass plan for the single-file flow
    Alpine.store('mode', singleSettings.mode);
    Alpine.store('passes', singleSettings.passes);
    Alpine.store('targetLongEdge', singleSettings.targetLongEdge);
    Alpine.store('maxPasses', MAX_PASSES);
    Alpine.store('nativeScale', NATIVE_SCALE);
    Alpine.store('plan', { progression: [], final: '', note: '', safetyLevel: 'ok', safetyMessage: '' });

    // Batch queue
    Alpine.store('batch', emptyBatchSnapshot());
    Alpine.store('includeSubfolders', false);

    Alpine.start();
    document.body.style.display = "block";

    initLanguage();
    initTheme();

    upscaled_canvas = document.getElementById("upscaled") as HTMLCanvasElement;
    original_canvas = document.getElementById('original') as HTMLCanvasElement;

    if (!("VideoEncoder" in window)) return showUnsupported("WebCodecs");

    if (!window.showSaveFilePicker) return showUnsupported("File Write System API");

    worker.postMessage({ cmd: 'isSupported' } satisfies WorkerRequestMessage);

    initBatch();

    window.chooseFile = chooseFile;
    window.switchNetworkSize = switchNetworkSize;
    window.initRecording = initRecording;
    window.setPage = setPage;
    initEditImageTools();
}

//===================  Multi-pass planning (single file) ===========================

/** Weights cache key for the currently selected network. */
function weightsKey(): string {
    return `${size}-${content}`;
}

function currentNetworkChoice() {
    return {
        name: networks[size].name,
        weightsKey: weightsKey(),
        weights: weights[size][content],
        size
    };
}

/** Source dimensions of whatever is loaded in the single-file preview. */
function singleSourceDimensions(): Dimensions | null {
    const width = Alpine.store('width') as number;
    const height = Alpine.store('height') as number;
    if (!width || !height) return null;
    return { width, height };
}

/**
 * Recompute the "expected progression" shown before processing. Purely
 * informational - it reports pixel dimensions, never quality claims.
 */
function updatePlan(): void {
    const source = singleSourceDimensions();
    if (!source) return;

    const passes = resolvePasses(source, singleSettings, MAX_PASSES);
    const final = resolveFinalDimensions(source, singleSettings, MAX_PASSES);

    const progression = passProgression(source, passes).map((d, i) => `Pass ${i + 1} → ${formatDimensions(d)}`);

    let note = '';
    if (singleSettings.mode === 'target') {
        const plan = planForTarget(source, singleSettings.targetLongEdge, MAX_PASSES);
        if (plan.alreadyAtOrAboveTarget) {
            note = `Source is already ${Math.max(source.width, source.height)}px on its long edge; ` +
                `running 1 pass gives ${formatDimensions(final)}.`;
        } else if (!plan.exact) {
            note = `Requested ${plan.requestedLongEdge}px long edge → native AI result ${formatDimensions(final)}` +
                (plan.cappedByMaxPasses ? ` (limited to ${MAX_PASSES} passes)` : '');
        }
    }

    const safety = evaluateSafety({
        source,
        passes,
        networkSize: size,
        caps: deviceCaps,
        bytesPerInputPixel: networkProfiles.get(networks[size].name),
        memoryBudgetBytes: memoryBudget,
        pngOutput: inputKind === 'image' ? imageMimeType === 'image/png' : false
    });

    Alpine.store('passes', passes);
    Alpine.store('plan', {
        progression,
        final: formatDimensions(final),
        note,
        safetyLevel: safety.level,
        safetyMessage: safety.reasons.join(' ')
    });
}

function setUpscaleMode(mode: UpscaleMode): void {
    singleSettings.mode = mode;
    Alpine.store('mode', mode);
    updatePlan();
}

function setPasses(value: number | string): void {
    const passes = Math.min(Math.max(1, Number(value) || 1), MAX_PASSES);
    singleSettings.passes = passes;
    Alpine.store('passes', passes);
    updatePlan();
}

function setTargetResolution(value: number | string): void {
    const target = Math.max(1, Number(value) || 1);
    singleSettings.targetLongEdge = target;
    Alpine.store('targetLongEdge', target);
    updatePlan();
}

window.setUpscaleMode = setUpscaleMode;
window.setPasses = setPasses;
window.setTargetResolution = setTargetResolution;

//===================  Batch processing ===========================

const batchLog: string[] = [];

function emptyBatchSnapshot() {
    return {
        active: false,
        running: false,
        cancelling: false,
        counts: { images: 0, videos: 0, unsupported: 0 },
        skipped: [] as { name: string; reason: string }[],
        items: [] as any[],
        global: { mode: 'passes', passes: 2, targetLongEdge: 4096 },
        options: { createPdf: false, pdfQuality: 'maximum', pdfName: '' },
        outputLabel: '',
        safety: { level: 'ok', reasons: [] as string[] },
        progressText: '',
        currentName: '',
        completed: 0,
        summary: null as any,
        log: [] as string[]
    };
}

function initBatch(): void {
    bridge = new WorkerBridge(worker);
    batch = new BatchController(bridge, currentNetworkChoice, {
        onChange: publishBatch,
        onLog: (message) => {
            console.log('[batch]', message);
            batchLog.push(message);
            if (batchLog.length > 200) batchLog.shift();
        }
    });
    batch.global = { mode: 'passes', passes: 2, targetLongEdge: 4096 };
    batch.memoryBudgetBytes = memoryBudget;
    batch.bytesPerInputPixel = networkProfiles;

    window.chooseFiles = chooseFiles;
    window.chooseFolder = chooseFolder;
    window.setIncludeSubfolders = (value: boolean) => {
        includeSubfolders = value;
        Alpine.store('includeSubfolders', value);
    };
    window.setBatchMode = (mode: UpscaleMode) => {
        batch.global = { ...batch.global, mode };
        publishBatch();
    };
    window.setBatchPasses = (value: number | string) => {
        batch.global = { ...batch.global, passes: Math.min(Math.max(1, Number(value) || 1), MAX_PASSES) };
        publishBatch();
    };
    window.setBatchTarget = (value: number | string) => {
        batch.global = { ...batch.global, targetLongEdge: Math.max(1, Number(value) || 1) };
        publishBatch();
    };
    window.setItemOverride = setItemOverride;
    window.removeBatchItem = (id: string) => batch.removeItem(id);
    window.setCreatePdf = (value: boolean) => {
        batch.options = { ...batch.options, createPdf: value };
        publishBatch();
    };
    window.setPdfQuality = (value: string) => {
        batch.options = { ...batch.options, pdfQuality: value as any };
        publishBatch();
    };
    window.setPdfName = (value: string) => {
        batch.options = { ...batch.options, pdfName: value };
    };
    window.chooseOutputFolder = chooseOutputFolder;
    window.startBatch = startBatch;
    window.cancelBatch = () => batch.cancel();
    window.resetBatch = () => {
        batchLog.length = 0;
        batch.reset();
        // Drop the worker's cached GPU instances so a new, unrelated batch does
        // not start out holding the previous one's buffers.
        bridge.releaseCache();
        Alpine.store('state', 'init');
    };
}

/**
 * Publish a plain snapshot for Alpine. The controller itself is kept out of the
 * reactive store because it holds file handles and other non-cloneable objects.
 */
function publishBatch(): void {
    const counts = batch.counts();
    const safety = batch.batchSafety();

    const items = batch.items.map((item) => {
        const settings = batch.settingsFor(item);
        const passes = batch.passesFor(item);
        const expected = batch.expectedFor(item);
        const report = batch.safetyFor(item);

        return {
            id: item.id,
            path: item.path,
            name: item.name,
            kindLabel: item.kind === 'image' ? 'Image' : 'Video',
            source: formatDimensions(item.source),
            modeLabel: settings.mode === 'passes' ? 'Passes' : 'Target',
            settingLabel: settings.mode === 'passes' ? `${passes}` : `${settings.targetLongEdge}px → ${passes}p`,
            overrideValue: item.override ? String(item.override.passes) : 'global',
            expected: formatDimensions(expected),
            status: item.status,
            statusLabel: statusLabel(item),
            error: item.error || '',
            outputName: item.outputName || '',
            blocked: report.level === 'block',
            warn: report.level === 'warn'
        };
    });

    const completed = batch.items.filter((i) => i.status === 'complete' || i.status === 'failed' || i.status === 'cancelled').length;
    const current = batch.currentIndex >= 0 ? batch.items[batch.currentIndex] : null;

    Alpine.store('batch', {
        active: batch.items.length > 0 || batch.skipped.length > 0,
        running: batch.running,
        cancelling: batch.cancelling,
        counts,
        skipped: batch.skipped.slice(0, 20),
        items,
        global: { ...batch.global },
        options: { ...batch.options },
        outputLabel: batch.outputDirectoryLabel,
        safety,
        progressText: batch.running ? `${completed} / ${batch.items.length} files completed` : '',
        currentName: current ? current.name : '',
        currentPass: current?.passProgress
            ? (current.kind === 'video'
                ? `${current.passProgress.percent}%`
                : `Pass ${current.passProgress.pass} / ${current.passProgress.passes}`)
            : '',
        completed,
        summary: batch.summary,
        log: batchLog.slice(-8)
    });
}

function statusLabel(item: BatchItem): string {
    switch (item.status) {
        case 'waiting': return 'Ready';
        case 'processing': return 'Processing';
        case 'complete': return 'Complete';
        case 'failed': return 'Failed';
        case 'cancelled': return 'Cancelled';
        default: return 'Skipped';
    }
}

function setItemOverride(id: string, value: string): void {
    const item = batch.items.find((i) => i.id === id);
    if (!item) return;

    if (value === 'global') {
        item.override = null;
    } else {
        item.override = { mode: 'passes', passes: Number(value), targetLongEdge: batch.global.targetLongEdge };
    }
    publishBatch();
}

/** Multiple files, one picker. */
async function chooseFiles(): Promise<void> {
    try {
        const handles = await window.showOpenFilePicker({
            types: [{
                description: 'Video or Image Files',
                accept: {
                    'video/mp4': ['.mp4', '.m4v'],
                    'video/quicktime': ['.mov'],
                    'image/png': ['.png'],
                    'image/jpeg': ['.jpg', '.jpeg'],
                    'image/webp': ['.webp']
                }
            }],
            multiple: true
        });

        if (!handles.length) return;

        Alpine.store('state', 'loading');
        batch.reset();
        batch.batchName = 'batch';
        await batch.addFiles(handles);
        Alpine.store('state', 'batch');
        publishBatch();
    } catch (e) {
        console.log('File selection cancelled', e);
        if ((Alpine.store('state') as string) === 'loading') Alpine.store('state', 'init');
    }
}

/**
 * Folder input. The File System Access API gives real directory handles here,
 * which also lets results be written straight back into `<folder>/upscaled/`.
 */
async function chooseFolder(): Promise<void> {
    if (!window.showDirectoryPicker) {
        return showError('This browser does not support folder selection. Use Chrome or Edge on desktop.');
    }

    try {
        const directory = await window.showDirectoryPicker({ mode: 'readwrite' });

        Alpine.store('state', 'loading');
        batch.reset();
        await batch.addDirectory(directory, includeSubfolders);

        try {
            await batch.useUpscaledSubfolder(directory);
        } catch (e) {
            console.warn('Could not create the upscaled/ output folder', e);
        }

        Alpine.store('state', 'batch');
        publishBatch();
    } catch (e) {
        console.log('Folder selection cancelled', e);
        if ((Alpine.store('state') as string) === 'loading') Alpine.store('state', 'init');
    }
}

async function chooseOutputFolder(): Promise<void> {
    if (!window.showDirectoryPicker) return;
    try {
        const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
        await batch.useDirectory(directory, `${directory.name}/`);
    } catch (e) {
        console.log('Output folder selection cancelled');
    }
}

async function startBatch(): Promise<void> {
    if (!batch.items.length) return;

    // Offer a real output folder before falling back to individual downloads.
    if (!batch.outputDirectory && window.showDirectoryPicker) {
        try {
            const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
            const output = await directory.getDirectoryHandle('upscaled', { create: true });
            await batch.useDirectory(output, `${directory.name}/upscaled/`);
        } catch (e) {
            console.log('No output folder chosen; falling back to browser downloads');
        }
    }

    batchLog.length = 0;
    await batch.run();
}

window.chooseFiles = chooseFiles;
window.chooseFolder = chooseFolder;

/**
 * Show unsupported browser feature message
 */
function showUnsupported(text: string): void {
    Alpine.store('component', text);
    Alpine.store('state', 'unsupported');
}

function initLanguage(): void {
    const stored = localStorage.getItem('lang');
    const browser = (navigator.language || '').slice(0, 2).toLowerCase();
    const initial = (stored as Lang) || (supportedLangs.includes(browser as Lang) ? (browser as Lang) : 'en');
    setLanguage(initial);
}

function setLanguage(lang: Lang): void {
    if (!supportedLangs.includes(lang)) return;
    currentLang = lang;
    localStorage.setItem('lang', lang);

    document.documentElement.setAttribute('lang', lang);
    const dict = translations[lang];

    const textNodes = document.querySelectorAll<HTMLElement>('[data-i18n]');
    textNodes.forEach((node) => {
        const key = node.getAttribute('data-i18n');
        if (!key || !dict[key]) return;
        const attr = node.getAttribute('data-i18n-attr');
        if (attr) {
            node.setAttribute(attr, dict[key]);
        } else {
            node.textContent = dict[key];
        }
    });

    const htmlNodes = document.querySelectorAll<HTMLElement>('[data-i18n-html]');
    htmlNodes.forEach((node) => {
        const key = node.getAttribute('data-i18n-html');
        if (!key || !dict[key]) return;
        node.innerHTML = dict[key];
    });

    const langButtons = document.querySelectorAll<HTMLButtonElement>('.lang-btn');
    langButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.lang === lang);
    });
}

window.setLanguage = setLanguage;

function setPage(page: PageKey): void {
    Alpine.store('page', page);
}

window.setPage = setPage;

function initTheme(): void {
    const stored = localStorage.getItem('theme') as ThemeMode | null;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: ThemeMode = stored || (prefersDark ? 'dark' : 'light');
    setTheme(initial);
}

function setTheme(theme: ThemeMode): void {
    currentTheme = theme;
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme(): void {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
}

window.toggleTheme = toggleTheme;

function initEditImageTools(): void {
    const input = document.getElementById('edit-image-input') as HTMLInputElement | null;
    if (!input) return;

    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        editImageName = file.name.replace(/\.[^/.]+$/, '') + '-edited.png';

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            editImage = img;
            drawEditedImage();
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });

    window.chooseEditImage = () => input.click();
    window.updateEditFilter = updateEditFilter;
    window.resetEditFilters = resetEditFilters;
    window.downloadEditedImage = downloadEditedImage;

    updateEditFilterLabels();
}

function editFilterString(): string {
    return `brightness(${editFilters.brightness}%) contrast(${editFilters.contrast}%) saturate(${editFilters.saturation}%) blur(${editFilters.blur}px) sepia(${editFilters.sepia}%)`;
}

function drawEditedImage(): void {
    if (!editImage) return;
    const canvas = document.getElementById('edit-preview-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = editImage.naturalWidth;
    canvas.height = editImage.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = editFilterString();
    ctx.drawImage(editImage, 0, 0);
    ctx.filter = 'none';
}

function updateEditFilter(name: string, value: string): void {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    if (!(name in editFilters)) return;
    (editFilters as Record<string, number>)[name] = numeric;
    updateEditFilterLabels();
    drawEditedImage();
}

function updateEditFilterLabels(): void {
    const labelMap: Record<string, string> = {
        brightness: `${Math.round(editFilters.brightness)}%`,
        contrast: `${Math.round(editFilters.contrast)}%`,
        saturation: `${Math.round(editFilters.saturation)}%`,
        blur: `${editFilters.blur.toFixed(1).replace(/\.0$/, '')}px`,
        sepia: `${Math.round(editFilters.sepia)}%`,
    };
    Object.entries(labelMap).forEach(([key, text]) => {
        const label = document.getElementById(`edit-${key}-value`);
        if (label) label.textContent = text;
    });
}

function resetEditFilters(): void {
    editFilters.brightness = 100;
    editFilters.contrast = 100;
    editFilters.saturation = 100;
    editFilters.blur = 0;
    editFilters.sepia = 0;

    (document.getElementById('edit-brightness') as HTMLInputElement | null)?.setAttribute('value', '100');
    (document.getElementById('edit-contrast') as HTMLInputElement | null)?.setAttribute('value', '100');
    (document.getElementById('edit-saturation') as HTMLInputElement | null)?.setAttribute('value', '100');
    (document.getElementById('edit-blur') as HTMLInputElement | null)?.setAttribute('value', '0');
    (document.getElementById('edit-sepia') as HTMLInputElement | null)?.setAttribute('value', '0');

    const b = document.getElementById('edit-brightness') as HTMLInputElement | null;
    const c = document.getElementById('edit-contrast') as HTMLInputElement | null;
    const s = document.getElementById('edit-saturation') as HTMLInputElement | null;
    const bl = document.getElementById('edit-blur') as HTMLInputElement | null;
    const sp = document.getElementById('edit-sepia') as HTMLInputElement | null;
    if (b) b.value = '100';
    if (c) c.value = '100';
    if (s) s.value = '100';
    if (bl) bl.value = '0';
    if (sp) sp.value = '0';

    updateEditFilterLabels();
    drawEditedImage();
}

function downloadEditedImage(): void {
    const canvas = document.getElementById('edit-preview-canvas') as HTMLCanvasElement | null;
    if (!canvas || !canvas.width || !canvas.height) return;

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = editImageName;
    link.click();
}

/**
 * Prompt user to choose a video file using File System Access API
 */
async function chooseFile(e?: Event): Promise<void> {
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{
                description: 'Video or Image Files',
                accept: {
                    'video/mp4': ['.mp4', '.m4v'],
                    'video/quicktime': ['.mov'],
                    'image/png': ['.png'],
                    'image/jpeg': ['.jpg', '.jpeg'],
                    'image/webp': ['.webp']
                }
            }],
            multiple: false
        });

        const file = await fileHandle.getFile();
        const kind = classifyFile(file.name);

        // Loading failures must surface as an error rather than leaving the
        // page on the loading spinner forever.
        try {
            if (kind === 'image') {
                await loadImage(fileHandle, file);
            } else if (kind === 'video') {
                await loadVideo(fileHandle, file);
            } else {
                showError(`Unsupported file type: ${file.name}`);
            }
        } catch (error: any) {
            console.error('Failed to load file', error);
            showError(error?.message || String(error));
        }
    } catch (e) {
        // User cancelled file picker
        console.log('File selection cancelled');
    }
}

//===================  Preview ===========================

/**
 * Load video file from FileSystemFileHandle
 */
async function loadVideo(fileHandle: FileSystemFileHandle, existingFile?: File): Promise<void> {
    Alpine.store('state', 'loading');
    inputKind = 'video';
    previewBitmap = null;

    // Store the file handle for later processing
    inputFileHandle = fileHandle;

    // Get the file to create a preview
    const file = existingFile || await fileHandle.getFile();

    // Set up download name
    download_name = file.name.split(".")[0] + "-upscaled.mp4";
    Alpine.store('download_name', download_name);
    Alpine.store('filename', file.name);

    // Read file for preview setup
    const arrayBuffer = await file.arrayBuffer();
    await setupPreview(arrayBuffer, file.type || 'video/mp4');
}

/**
 * Load an image file and set up preview
 */
async function loadImage(fileHandle: FileSystemFileHandle, file: File): Promise<void> {
    Alpine.store('state', 'loading');
    inputKind = 'image';
    inputFileHandle = fileHandle;
    imageMimeType = file.type || 'image/png';

    const ext = imageMimeType === 'image/jpeg' ? 'jpg' : 'png';
    download_name = file.name.split(".")[0] + `-upscaled.${ext}`;
    Alpine.store('download_name', download_name);
    Alpine.store('filename', file.name);

    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    previewBitmap = bitmap;

    await setupImagePreview(bitmap);
}

/**
 * Set up the preview UI with before/after comparison
 */
async function setupPreview(data: ArrayBuffer, mimeType: string = 'video/mp4'): Promise<void> {
    video = document.createElement('video');

    const fileBlob = new Blob([data], { type: mimeType });

    video.src = URL.createObjectURL(fileBlob);

    const imageCompare = document.getElementById('image-compare-outer') as HTMLElement;



    video.onloadeddata = async function (){



        Alpine.store('width', video.videoWidth);
        Alpine.store('height', video.videoHeight);

        imageCompare.style.height = '318px';
        imageCompare.style.width =  `${Math.round(video.videoWidth/video.videoHeight*318)}px`
        imageCompare.style.margin = 'auto';
        imageCompare.style.position = 'relative';


        mountImageCompare();
        video.currentTime = video.duration * 0.2 || 0;
        if(video.requestVideoFrameCallback)  video.requestVideoFrameCallback(showPreview);
        else requestAnimationFrame(showPreview);

    }




    async function showPreview(){

        const fullScreenButton = document.getElementById('full-screen');


        window.initRecording = initRecording;
        window.fullScreenPreview = fullScreenPreview;

        const bitmap = await createImageBitmap(video);

        const { transfer, canvases } = previewInitPayload({
            width: video.videoWidth,
            height: video.videoHeight
        });

        worker.postMessage({cmd: "init", data: {
                bitmap,
                ...canvases,
                resolution: {
                    width: video.videoWidth,
                    height: video.videoHeight
                }

            }}, [bitmap, ...transfer]);


        // Default to 'rl' (real life) network
        content = 'rl';
        await updateNetwork();
        Alpine.store('style', 'rl');









        function setFullScreenLocation(){
            const containerWidth = Math.round(video.videoWidth/video.videoHeight*318);
            const containerHeight = 318;
            
            // Position at bottom-right of the preview container (with small padding)
            fullScreenButton.style.left = `${imageCompare.offsetLeft + containerWidth - 20}px`;
            fullScreenButton.style.top = `${imageCompare.offsetTop + containerHeight - 20}px`;
        }

        setTimeout(setFullScreenLocation, 20);
        setTimeout(setFullScreenLocation, 60);
        setTimeout(setFullScreenLocation, 200);





        imageCompare.addEventListener('fullscreenchange', function () {
            if(!document.fullscreenElement){
                // Reset canvas styles
                upscaled_canvas.style.width = ``;
                upscaled_canvas.style.height = ``;
                original_canvas.style.width = ``;
                original_canvas.style.height = ``;
                
                // Reset container styles to original preview dimensions
                const imageCompareOuter = document.getElementById('image-compare-outer');
                const imageCompareInner = document.getElementById('image-compare');
                
                // Reset outer container
                imageCompareOuter.style.width = ``;
                imageCompareOuter.style.height = ``;
                imageCompareOuter.style.backgroundColor = ``;
                imageCompareOuter.style.display = ``;
                imageCompareOuter.style.justifyContent = ``;
                imageCompareOuter.style.alignItems = ``;
                
                // Reset inner container to original preview size
                imageCompareInner.style.height = '318px';
                imageCompareInner.style.width = `${Math.round(video.videoWidth/video.videoHeight*318)}px`;
                imageCompareInner.style.margin = 'auto';
                imageCompareInner.style.position = 'relative';
            }
        });

        let bitrate = getBitrate();

        const estimated_size = (bitrate/8)*video.duration + (128/8)*video.duration; // Assume 128 kbps audio

        if(estimated_size > 1900*1024*1024){
            Alpine.store('target', 'writer');
        } else {
            Alpine.store('target', 'blob');
        }

        const quota = (await navigator.storage.estimate()).quota;

        if(estimated_size > quota){
            return showError(`The video is too big. It would output a file of ${humanFileSize(estimated_size)} but the browser can only write files up to ${humanFileSize(quota)}`);
        }


        Alpine.store('size', humanFileSize(estimated_size))

        updatePlan();


        function canvasFullScreen(){
            // Calculate aspect ratios
            const videoAspectRatio = video.videoWidth / video.videoHeight;
            const screenAspectRatio = window.innerWidth / window.innerHeight;
            
            let displayWidth, displayHeight;

            const imageCompareOuter = document.getElementById('image-compare-outer');
            const imageCompareInner = document.getElementById('image-compare');
            
            // If video is wider than screen, fit to width (letterbox on top/bottom)
            if (videoAspectRatio > screenAspectRatio) {
                displayWidth = window.innerWidth;
                displayHeight = window.innerWidth / videoAspectRatio;
            } 
            // If video is taller than screen, fit to height (pillarbox on sides)
            else {
                displayWidth = window.innerHeight * videoAspectRatio;
                displayHeight = window.innerHeight;
            }
            
            // Style the outer container to fill screen with black background and center content
            imageCompareOuter.style.width = `${window.innerWidth}px`;
            imageCompareOuter.style.height = `${window.innerHeight}px`;
            imageCompareOuter.style.backgroundColor = 'black';
            imageCompareOuter.style.display = 'flex';
            imageCompareOuter.style.justifyContent = 'center';
            imageCompareOuter.style.alignItems = 'center';
            

            console.log("Image Compare Outer", imageCompareOuter);
            console.log("Image Compare Inner", imageCompareInner);
            // Size the inner container to maintain aspect ratio
            imageCompareInner.style.width = `${displayWidth}px`;
            imageCompareInner.style.height = `${displayHeight}px`;
            
            // Let the canvases fill their parent container
            upscaled_canvas.style.width = `${displayWidth}px`;
            upscaled_canvas.style.height = `${displayHeight}px`;
            original_canvas.style.width = `${displayWidth}px`;
            original_canvas.style.height = `${displayHeight}px`;
        }

        async function fullScreenPreview(e) {
            imageCompare.requestFullscreen();
            setTimeout(canvasFullScreen, 20);
            setTimeout(canvasFullScreen, 60);
            setTimeout(canvasFullScreen, 200);

        }


        Alpine.store('state', 'preview');




        window.switchNetworkSize = switchNetworkSize;

        window.switchNetworkStyle = async function(el: HTMLInputElement){
            if(el.value !== content){
                content = el.value as ContentType;

                await updateNetwork();
            }
        }



    }

}

async function switchNetworkSize(el: HTMLInputElement): Promise<void> {
    if (el.value !== size) {
        size = el.value as NetworkSize;
        if (video || previewBitmap) {
            await updateNetwork();
        }
        // Network size changes the memory estimate, so refresh the plan/warnings.
        updatePlan();
        if (batch) publishBatch();
    }
    Alpine.store('networkSizeLabel', size.charAt(0).toUpperCase() + size.slice(1));
}

/**
 * Set up preview UI for a single image
 */
async function setupImagePreview(bitmap: ImageBitmap): Promise<void> {
    const imageCompare = document.getElementById('image-compare-outer') as HTMLElement;

    Alpine.store('width', bitmap.width);
    Alpine.store('height', bitmap.height);

    const { transfer, canvases } = previewInitPayload({ width: bitmap.width, height: bitmap.height });

    imageCompare.style.height = '318px';
    imageCompare.style.width = `${Math.round(bitmap.width / bitmap.height * 318)}px`;
    imageCompare.style.margin = 'auto';
    imageCompare.style.position = 'relative';

    mountImageCompare();

    worker.postMessage({
        cmd: "init",
        data: {
            bitmap,
            ...canvases,
            resolution: {
                width: bitmap.width,
                height: bitmap.height
            },
            preserveAlpha: imageMimeType === 'image/png'
        }
    }, transfer);

    content = 'rl';
    await updateNetwork();
    Alpine.store('style', 'rl');

    Alpine.store('target', 'image');
    Alpine.store('size', humanFileSize(bitmap.width * bitmap.height * 4));
    updatePlan();
    Alpine.store('state', 'preview');
}

/**
 * Handle messages from the video processing worker
 */
worker.onmessage = function (event: MessageEvent<WorkerResponseMessage>) {
    // Batch jobs are correlated by jobId and resolved through the bridge.
    if (bridge && bridge.handleMessage(event.data)) return;

    if (event.data.cmd === 'isSupported') {
        const supported = event.data.data;

        if (!supported) return showUnsupported("WebGPU");

        if (event.data.caps) {
            deviceCaps = event.data.caps;
            if (batch) batch.caps = deviceCaps;
            console.log('[upscaler] GPU limits', deviceCaps);
            updatePlan();
        }

    } else if (event.data.cmd === 'networkProfile') {
        // The worker measured what this network actually allocates; use it for
        // memory predictions from now on.
        networkProfiles.set(event.data.data.name, event.data.data.bytesPerInputPixel);
        if (batch) {
            batch.bytesPerInputPixel = networkProfiles;
            publishBatch();
        }
        updatePlan();

    } else if (event.data.cmd === 'pass') {
        const { pass, passes, width, height } = event.data.data;
        Alpine.store('passStatus', `Pass ${pass} / ${passes} → ${width} x ${height}`);

    } else if (event.data.cmd === 'progress') {
        Alpine.store('progress', event.data.data);
        Alpine.store('state', 'processing');

    } else if (event.data.cmd === 'process') {
        // Processing started

    } else if (event.data.cmd === 'error') {
        showError(event.data.data);

    } else if (event.data.cmd === 'eta') {
        Alpine.store('eta', event.data.data);

    } else if (event.data.cmd === 'finished') {
        Alpine.store('state', 'complete');
        const blob = new Blob([event.data.data], { type: "video/mp4" });
        Alpine.store('download_url', window.URL.createObjectURL(blob));
    } else if (event.data.cmd === 'finishedImage') {
        Alpine.store('state', 'complete');
        const blob = new Blob([event.data.data], { type: event.data.mimeType || imageMimeType });
        Alpine.store('download_url', window.URL.createObjectURL(blob));
    }
};



/**
 * Switch to a different upscaling network
 */
async function updateNetwork(): Promise<void> {
    let bitmap = previewBitmap;
    if (!bitmap) {
        if (inputKind === 'image') {
            const file = await inputFileHandle.getFile();
            bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            previewBitmap = bitmap;
        } else {
            bitmap = await createImageBitmap(video);
        }
    }

    worker.postMessage({
        cmd: 'network',
        data: {
            name: networks[size].name,
            bitmap,
            weights: weights[size][content],
            preserveAlpha: inputKind === 'image' && imageMimeType === 'image/png'
        }
    } satisfies WorkerRequestMessage);
}

//===================  Process ===========================

/**
 * Start the video upscaling process
 */
async function initRecording(): Promise<void> {
    const source = singleSourceDimensions();
    const passes = source ? resolvePasses(source, singleSettings, MAX_PASSES) : 1;

    // Refuse jobs the device provably cannot run, rather than failing mid-pass.
    if (source) {
        const safety = evaluateSafety({
            source,
            passes,
            networkSize: size,
            caps: deviceCaps,
            bytesPerInputPixel: networkProfiles.get(networks[size].name),
            memoryBudgetBytes: memoryBudget,
            pngOutput: inputKind === 'image' ? imageMimeType === 'image/png' : false
        });
        if (safety.level === 'block') {
            return showError(safety.reasons.join(' '));
        }
    }

    Alpine.store('state', 'loading');
    Alpine.store('passStatus', '');

    const passOptions = {
        name: networks[size].name,
        weightsKey: weightsKey(),
        passes
    };

    if (passes > 1) {
        // Weights are cached in the worker by key, so this only transfers once.
        bridge.registerWeights(passOptions.weightsKey, weights[size][content]);
    }

    if (inputKind === 'image' && previewBitmap) {
        worker.postMessage({
            cmd: 'processImage',
            data: {
                bitmap: previewBitmap,
                mimeType: imageMimeType,
                options: passOptions
            }
        } satisfies WorkerRequestMessage);
        return;
    }

    let bitrate = getBitrate();
    const estimated_size = (bitrate / 8) * video.duration + (128 / 8) * video.duration; // Assume 128 kbps audio

    let outputHandle: FileSystemFileHandle | undefined;

    // Max Blob size - 10 MB (for testing, should be much higher in production)
    if (estimated_size > 1900 * 1024 * 1024) {
        try {
            outputHandle = await showFilePicker();
        } catch (e) {
            console.warn("User aborted request");
            return Alpine.store('state', 'preview');
        }
    }

    worker.postMessage({
        cmd: "process",
        inputHandle: inputFileHandle,
        outputHandle,
        options: passOptions
    } satisfies WorkerRequestMessage);
}

/**
 * Display error message to user
 */
function showError(message: string): void {
    Alpine.store('state', 'error');
    Alpine.store('error', message);
}

/**
 * Calculate target bitrate based on video resolution
 */
function getBitrate(): number {
    // Each extra pass quadruples the pixel count, so scale the estimate with it.
    const passes = resolvePasses(
        { width: video.videoWidth, height: video.videoHeight },
        singleSettings,
        MAX_PASSES
    );
    const passFactor = NATIVE_SCALE ** (2 * (passes - 1));
    return 5e6 * (video.videoWidth * video.videoHeight * 4 * passFactor) / (1280 * 720);
}

/**
 * Format bytes into human-readable file size
 */
function humanFileSize(bytes: number, si: boolean = false, dp: number = 1): string {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }

    const units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

    return bytes.toFixed(dp) + ' ' + units[u];
}

/**
 * Show native file picker for saving output video
 */
async function showFilePicker(): Promise<FileSystemFileHandle> {
    const handle = await window.showSaveFilePicker({
        startIn: 'downloads',
        suggestedName: download_name,
        types: [{
            description: 'Video File',
            accept: { 'video/mp4': ['.mp4'] }
        }],
    });

    return handle;
}
