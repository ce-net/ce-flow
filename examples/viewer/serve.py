#!/usr/bin/env python3
"""Static server for ce-flow viewer (local dev / ceapp daemon).

Serves the repo root so /host/index.html can import ../components and ../lib as ES modules.
In production the bundle is published content-addressed (ce-publish) and served by ce-serve/ce-hub
with /mesh-bridge; this file exists so `ce app install ce-flow viewer` gives an instant local UI.
"""

import http.server
import os
import urllib.request

PORT = int(os.environ.get("PORT", "8979"))
NODE = os.environ.get("CE_NODE_URL", "http://127.0.0.1:8844")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # ce-comp repo root: /loader and /examples both served


def api_token():
    tok = os.environ.get("CE_API_TOKEN")
    if tok:
        return tok
    home = os.path.expanduser("~")
    for p in (
        os.path.join(home, "Library/Application Support/ce/api.token"),
        os.path.join(home, ".local/share/ce/api.token"),
    ):
        try:
            with open(p) as f:
                return f.read().strip()
        except OSError:
            pass
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static files + a same-origin `/node/*` proxy to the local ce node.

    The node's CORS is deliberately read-only (mutating routes are bearer-gated, browser reach
    goes through /mesh-bridge in production). This proxy is the local-dev equivalent of that
    bridge, inside THIS app — the substrate stays untouched.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _proxy(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(NODE + self.path[len("/node"):], data=body, method=self.command)
        for h in ("Authorization", "Content-Type"):
            if self.headers.get(h):
                req.add_header(h, self.headers[h])
        # Localhost trust domain: the proxy ALWAYS signs with the node's own api token — pages
        # never carry tokens (URL tokens mangle: '+' decodes to space and 401s; stale tabs
        # forwarding old tokens do the same).
        tok = api_token()
        if tok:
            req.remove_header("Authorization")
            req.add_header("Authorization", "Bearer " + tok)
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = r.read()
                self.send_response(r.status)
                self.send_header("Content-Type", r.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:  # noqa: BLE001
            self.send_error(502, str(e))

    def do_GET(self):
        if self.path.startswith("/node/"):
            return self._proxy()
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/node/"):
            return self._proxy()
        self.send_error(404)


if __name__ == "__main__":
    print(f"ce-flow viewer serving {ROOT} on http://127.0.0.1:{PORT}/examples/viewer/")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
