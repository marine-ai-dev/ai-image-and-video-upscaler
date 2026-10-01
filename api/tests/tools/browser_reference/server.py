"""Tiny static server for gen.html: serves the real WebSR build, the website's weights and
the harness inputs, and accepts POSTed results into ./_out (git-ignored)."""
import http.server
import os
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
OUT = os.path.join(HERE, "_out")


class Handler(http.server.SimpleHTTPRequestHandler):
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

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("http://127.0.0.1:8097/gen.html")
    http.server.ThreadingHTTPServer(("127.0.0.1", 8097), Handler).serve_forever()
