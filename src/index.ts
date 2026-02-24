import Alpine from 'alpinejs';
import ImageCompare from './lib/image-compare-viewer.min';
import WebSR from '@websr/websr';
import type { WorkerRequestMessage, WorkerResponseMessage } from './types/worker-messages';

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
        setLanguage: (lang: Lang) => void;
        toggleTheme: () => void;
        setPage: (page: PageKey) => void;
    }
}

type Lang = 'en' | 'uk';

const translations: Record<Lang, Record<string, string>> = {
    en: {
        'meta.title': 'AI Video Upscaler — in your browser',
        'meta.description': 'Browser-only AI video upscaler. Free, fast, no installs. Your video stays on your device.',
        'meta.og_title': 'AI Video Upscaler',
        'meta.og_description': 'Browser-only AI video upscaler. Free, fast, no installs. Your video stays on your device.',
        'meta.twitter_title': 'AI Video Upscaler',
        'meta.twitter_description': 'Browser-only AI video upscaler. Free, fast, no installs. Your video stays on your device.',
        'brand.name': 'MarineAI',
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
        'file.choose_button': 'Choose a file',
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
    },
    uk: {
        'meta.title': 'AI-апскейлер відео — у вашому браузері',
        'meta.description': 'Браузерний AI-апскейлер відео. Безкоштовно, швидко, без інсталяцій. Відео залишається на вашому пристрої.',
        'meta.og_title': 'AI-апскейлер відео',
        'meta.og_description': 'Браузерний AI-апскейлер відео. Безкоштовно, швидко, без інсталяцій. Відео залишається на вашому пристрої.',
        'meta.twitter_title': 'AI-апскейлер відео',
        'meta.twitter_description': 'Браузерний AI-апскейлер відео. Безкоштовно, швидко, без інсталяцій. Відео залишається на вашому пристрої.',
        'brand.name': 'MarineAI',
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
        'file.choose_button': 'Обрати файл',
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
    }
};

const supportedLangs: Lang[] = ['en', 'uk'];
let currentLang: Lang = 'en';
type ThemeMode = 'light' | 'dark';
let currentTheme: ThemeMode = 'light';
type PageKey = 'home' | 'upscaler';

document.addEventListener("DOMContentLoaded", index);

//===================  Initial Load ===========================

/**
 * Main initialization function called on page load
 */
async function index(): Promise<void> {
    Alpine.store('state', 'init');
    Alpine.store('networkSizeLabel', 'Medium');
    Alpine.store('page', 'upscaler');

    Alpine.start();
    document.body.style.display = "block";

    initLanguage();
    initTheme();

    upscaled_canvas = document.getElementById("upscaled") as HTMLCanvasElement;
    original_canvas = document.getElementById('original') as HTMLCanvasElement;

    if (!("VideoEncoder" in window)) return showUnsupported("WebCodecs");

    if (!window.showSaveFilePicker) return showUnsupported("File Write System API");

    worker.postMessage({ cmd: 'isSupported' } satisfies WorkerRequestMessage);

    window.chooseFile = chooseFile;
    window.switchNetworkSize = switchNetworkSize;
    window.initRecording = initRecording;
    window.setPage = setPage;
}

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

/**
 * Prompt user to choose a video file using File System Access API
 */
async function chooseFile(e?: Event): Promise<void> {
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{
                description: 'Video or Image Files',
                accept: {
                    'video/mp4': ['.mp4'],
                    'image/png': ['.png'],
                    'image/jpeg': ['.jpg', '.jpeg']
                }
            }],
            multiple: false
        });

        const file = await fileHandle.getFile();
        if (file.type.startsWith('image/')) {
            await loadImage(fileHandle, file);
        } else {
            await loadVideo(fileHandle);
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
async function loadVideo(fileHandle: FileSystemFileHandle): Promise<void> {
    Alpine.store('state', 'loading');
    inputKind = 'video';
    previewBitmap = null;

    // Store the file handle for later processing
    inputFileHandle = fileHandle;

    // Get the file to create a preview
    const file = await fileHandle.getFile();

    // Set up download name
    download_name = file.name.split(".")[0] + "-upscaled.mp4";
    Alpine.store('download_name', download_name);
    Alpine.store('filename', file.name);

    // Read file for preview setup
    const arrayBuffer = await file.arrayBuffer();
    await setupPreview(arrayBuffer);
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
async function setupPreview(data: ArrayBuffer): Promise<void> {
    video = document.createElement('video');

    const fileBlob = new Blob([data], { type: "video/mp4" });

    video.src = URL.createObjectURL(fileBlob);

    const imageCompare = document.getElementById('image-compare-outer') as HTMLElement;



    video.onloadeddata = async function (){



        Alpine.store('width', video.videoWidth);
        Alpine.store('height', video.videoHeight);
        upscaled_canvas.width = video.videoWidth*2;
        upscaled_canvas.height = video.videoHeight*2;
        original_canvas.width = video.videoWidth*2;
        original_canvas.height = video.videoHeight*2;


        imageCompare.style.height = '318px';
        imageCompare.style.width =  `${Math.round(video.videoWidth/video.videoHeight*318)}px`
        imageCompare.style.margin = 'auto';
        imageCompare.style.position = 'relative';


        new ImageCompare(document.getElementById('image-compare')).mount();
        video.currentTime = video.duration * 0.2 || 0;
        if(video.requestVideoFrameCallback)  video.requestVideoFrameCallback(showPreview);
        else requestAnimationFrame(showPreview);

    }




    async function showPreview(){

        const fullScreenButton = document.getElementById('full-screen');


        window.initRecording = initRecording;
        window.fullScreenPreview = fullScreenPreview;

        const bitmap = await createImageBitmap(video);


        const upscaled = upscaled_canvas.transferControlToOffscreen();
        const original =    original_canvas.transferControlToOffscreen();


        worker.postMessage({cmd: "init", data: {
                bitmap,
                upscaled,
                original,
                resolution: {
                    width: video.videoWidth,
                    height: video.videoHeight
                }

            }}, [bitmap, upscaled, original]);


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
    upscaled_canvas.width = bitmap.width * 2;
    upscaled_canvas.height = bitmap.height * 2;
    original_canvas.width = bitmap.width * 2;
    original_canvas.height = bitmap.height * 2;

    imageCompare.style.height = '318px';
    imageCompare.style.width = `${Math.round(bitmap.width / bitmap.height * 318)}px`;
    imageCompare.style.margin = 'auto';
    imageCompare.style.position = 'relative';

    new ImageCompare(document.getElementById('image-compare')).mount();

    const upscaled = upscaled_canvas.transferControlToOffscreen();
    const original = original_canvas.transferControlToOffscreen();

    worker.postMessage({
        cmd: "init",
        data: {
            bitmap,
            upscaled,
            original,
            resolution: {
                width: bitmap.width,
                height: bitmap.height
            }
        }
    }, [upscaled, original]);

    content = 'rl';
    await updateNetwork();
    Alpine.store('style', 'rl');

    Alpine.store('target', 'image');
    Alpine.store('size', humanFileSize(bitmap.width * bitmap.height * 4));
    Alpine.store('state', 'preview');
}

/**
 * Handle messages from the video processing worker
 */
worker.onmessage = function (event: MessageEvent<WorkerResponseMessage>) {
    if (event.data.cmd === 'isSupported') {
        const supported = event.data.data;

        if (!supported) return showUnsupported("WebGPU");

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
            weights: weights[size][content]
        }
    } satisfies WorkerRequestMessage);
}

//===================  Process ===========================

/**
 * Start the video upscaling process
 */
async function initRecording(): Promise<void> {
    Alpine.store('state', 'loading');

    if (inputKind === 'image' && previewBitmap) {
        worker.postMessage({
            cmd: 'processImage',
            data: {
                bitmap: previewBitmap,
                mimeType: imageMimeType
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
        outputHandle
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
    return 5e6 * (video.videoWidth * video.videoHeight * 4) / (1280 * 720);
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
