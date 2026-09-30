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
    '.map': 'application/json; charset=utf-8'
};

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
    const headers = {
        'Content-Type': MIME[extension] || 'application/octet-stream',
        'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff'
    };

    if (req.method === 'HEAD') {
        res.writeHead(200, headers);
        return res.end();
    }

    res.writeHead(200, headers);
    pipeline(fs.createReadStream(file), res, (error) => {
        if (error && !res.writableEnded) res.destroy();
    });
});

server.listen(PORT, HOST, () => {
    console.log(`Serving ${ROOT} on http://${HOST}:${PORT}`);
});
