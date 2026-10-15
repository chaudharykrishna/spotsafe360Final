#!/usr/bin/env python3
"""Static server for playtesting that forbids ALL browser caching,
so every reload fetches the freshest files from the workspace."""
import functools
import http.server

ROOT = "/home/user/final_build/spotsafe360"

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer(("0.0.0.0", 8080), handler) as httpd:
        httpd.serve_forever()
