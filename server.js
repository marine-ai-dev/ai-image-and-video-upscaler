/**
 * Static file server for the production build.
 *
 * The app is a set of pre-rendered pages (/, /en/, /uk/, /edit-images/) plus
 * assets, so this only has to map URLs onto files in dist/ - there is no SPA
 * fallback, because every route is a real directory with its own index.html.
 *
 * Deliberately dependency-free: the build already pulls in a large toolchain,
 * and a production server that can be read in one sitting is easier to trust
 * than one that cannot.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream');

const ROOT = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8'
};

// Text-like formats shrink a lot under gzip/brotli; images, video and wasm are
// already compressed (or compress poorly), so they are sent as they are.
const COMPRESSIBLE = new Set([
    '.html', '.js', '.mjs', '.css', '.json', '.svg', '.webmanifest', '.txt', '.xml', '.map'
]);

// Webpack emits JS as name.<8 hex chars>.js; its content hash changes whenever
// the file does, so these are safe to cache forever. The edit-images app is
// built separately with Vite, which hashes its assets as name-<8 chars>.ext.
const WEBPACK_HASHED = /\.[0-9a-f]{8}\.(?:js|css)$/;
const VITE_HASHED = /^edit-images\/assets\/.+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/;

const CACHE_FOREVER = 'public, max-age=31536000, immutable';
// Everything else keeps its name across deploys, so browsers must revalidate it
// (answered with a 304 thanks to the ETag below) rather than trust it for a year.
const CACHE_REVALIDATE = 'no-cache';

function isContentHashed(file) {
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    return WEBPACK_HASHED.test(relative) || VITE_HASHED.test(relative);
}

/**
 * Compressed copies of every compressible file, made once at startup.
 * Compressing the multi-MB bundle per request would burn CPU on every visit;
 * dist/ does not change while the server runs, so a one-off pass is enough.
 * Maps absolute file path -> { gzip: Buffer, br: Buffer }.
 */
const compressed = new Map();

function precompress(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            precompress(full);
        } else if (entry.isFile() && COMPRESSIBLE.has(path.extname(entry.name).toLowerCase())) {
            const content = fs.readFileSync(full);
            compressed.set(full, {
                gzip: zlib.gzipSync(content, { level: 9 }),
                br: zlib.brotliCompressSync(content, {
                    params: {
                        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
                        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: content.length
                    }
                })
            });
        }
    }
}

/** Pick the best encoding the client accepts: brotli, then gzip, else null. */
function chooseEncoding(acceptEncoding) {
    const accepted = String(acceptEncoding || '').toLowerCase().split(',').map((part) => {
        const [name, ...params] = part.trim().split(';');
        const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
        return { name, q: q ? Number(q.slice(2)) : 1 };
    }).filter((item) => item.q > 0).map((item) => item.name);

    if (accepted.includes('br')) return 'br';
    if (accepted.includes('gzip')) return 'gzip';
    return null;
}

/**
 * Resolve a URL path to a file inside dist/, or null if it escapes the root or
 * does not exist. Directories resolve to their index.html.
 */
function resolveFile(urlPath) {
    let decoded;
    try {
        decoded = decodeURIComponent(urlPath.split('?')[0]);
    } catch {
        return null;
    }

    const candidate = path.normalize(path.join(ROOT, decoded));
    // path.normalize collapses "..", so anything outside ROOT is rejected here.
    if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) return null;

    let stats;
    try {
        stats = fs.statSync(candidate);
    } catch {
        return null;
    }

    if (stats.isDirectory()) {
        const index = path.join(candidate, 'index.html');
        return fs.existsSync(index) ? index : null;
    }

    return candidate;
}

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Allow': 'GET, HEAD' });
        return res.end('Method Not Allowed');
    }

    const file = resolveFile(req.url || '/');

    if (!file) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not Found');
    }

    const extension = path.extname(file).toLowerCase();
    const isHtml = extension === '.html';

    // Hashed bundles and images can be cached hard; the HTML that points at
    // them must not be, or a deploy would keep serving the previous pages.
    // Files that keep the same name across deploys (logo, icons, manifest,
    // robots.txt...) are revalidated for the same reason.
    const stats = fs.statSync(file);
    const headers = {
        'Content-Type': MIME[extension] || 'application/octet-stream',
        'Cache-Control': !isHtml && isContentHashed(file) ? CACHE_FOREVER : CACHE_REVALIDATE,
        'ETag': `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`,
        'X-Content-Type-Options': 'nosniff'
    };

    // Compressible files vary by Accept-Encoding even when this particular
    // client gets the plain version, so caches must be told in both cases.
    const variants = compressed.get(file);
    let body = null;
    if (variants) {
        headers['Vary'] = 'Accept-Encoding';
        const encoding = chooseEncoding(req.headers['accept-encoding']);
        if (encoding) {
            body = variants[encoding];
            headers['Content-Encoding'] = encoding;
            headers['Content-Length'] = body.length;
        }
    }

    // Unchanged since the browser last fetched it: skip the body.
    if (req.headers['if-none-match'] === headers['ETag']) {
        res.writeHead(304, headers);
        return res.end();
    }

    if (req.method === 'HEAD') {
        res.writeHead(200, headers);
        return res.end();
    }

    res.writeHead(200, headers);
    if (body) return res.end(body);

    pipeline(fs.createReadStream(file), res, (error) => {
        if (error && !res.writableEnded) res.destroy();
    });
});

precompress(ROOT);

server.listen(PORT, HOST, () => {
    console.log(`Serving ${ROOT} on http://${HOST}:${PORT}`);
});
