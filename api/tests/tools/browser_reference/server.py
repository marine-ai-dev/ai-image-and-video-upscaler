"""Tiny static server for gen.html: serves the real WebSR build, the website's weights and
the harness inputs, transpiles the website's own pipeline modules (src/lib/*.ts -> /lib/*)
so the harness runs the same code as the app, and accepts POSTed results into ./_out
(git-ignored; override with BROWSER_REF_OUT)."""
import http.server
import os
import re
import subprocess
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
API = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
REPO = os.path.dirname(API)
ROUTES = {
    "/websr.js": os.path.join(REPO, "node_modules", "@websr", "websr", "dist", "websr.js"),
}
PREFIXES = {
    "/weights/": os.path.join(REPO, "src", "weights") + os.sep,
    "/input/": os.path.join(API, "tests", "reference") + os.sep,
}
OUT = os.environ.get("BROWSER_REF_OUT") or os.path.join(HERE, "_out")
LIB = os.path.join(REPO, "src", "lib")

_TRANSPILE = """
const ts = require(process.argv[1] + '/node_modules/typescript');
const src = require('fs').readFileSync(process.argv[2], 'utf8');
process.stdout.write(ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText);
"""
_cache = {}


def transpile(name):
    """JavaScript for src/lib/<name>.ts, or None. Requires node and the repo's typescript."""
    if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
        return None
    path = os.path.join(LIB, name + ".ts")
    if not os.path.isfile(path):
        return None
    mtime = os.path.getmtime(path)
    hit = _cache.get(path)
    if hit and hit[0] == mtime:
        return hit[1]
    js = subprocess.run(["node", "-e", _TRANSPILE, REPO, path], check=True, capture_output=True).stdout
    _cache[path] = (mtime, js)
    return js


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        p = urllib.parse.urlparse(self.path).path
        m = re.fullmatch(r"/lib/([A-Za-z0-9_-]+)(?:\.js)?", p)
        if m:
            js = transpile(m.group(1))
            if js is None:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript")
            self.send_header("Content-Length", str(len(js)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(js)
            return
        super().do_GET()

    def translate_path(self, path):
        p = urllib.parse.urlparse(path).path
        if p in ROUTES:
            return ROUTES[p]
        for prefix, root in PREFIXES.items():
            if p.startswith(prefix):
                # inputs live in tests/reference/ and tests/reference/harness/
                rel = os.path.normpath(p[len(prefix):]).lstrip(os.sep)
                for base in (root, os.path.join(root, "harness") + os.sep):
                    cand = os.path.join(base, rel)
                    if os.path.exists(cand):
                        return cand
                return os.path.join(root, rel)
        return os.path.join(HERE, p.lstrip("/"))

    def do_POST(self):
        name = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)["name"][0]
        data = self.rfile.read(int(self.headers["Content-Length"]))
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, os.path.basename(name)), "wb") as fh:
            fh.write(data)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def end_headers(self):
        # Lets a page served by the app's dev server (localhost) fetch reference
        # inputs and POST captures; any other origin gets no CORS access.
        origin = self.headers.get("Origin", "")
        if urllib.parse.urlparse(origin).hostname in ("localhost", "127.0.0.1"):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Headers", "*")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("http://127.0.0.1:8097/gen.html")
    http.server.ThreadingHTTPServer(("127.0.0.1", 8097), Handler).serve_forever()
