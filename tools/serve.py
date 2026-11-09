#!/usr/bin/env python3
"""Serve this folder on localhost with no-cache headers, so a preview is never stale.

Usage: python3 tools/serve.py <port>        (run from the repo or worktree root)
"""
import functools, http.server, os, socket, sys, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):  # quiet: only errors
        if args and str(args[1])[:1] in "45":
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


def main():
    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        sys.exit("Usage: python3 tools/serve.py <port>")
    port = int(sys.argv[1])
    handler = functools.partial(NoStore, directory=ROOT)

    class V6(http.server.ThreadingHTTPServer):
        address_family = socket.AF_INET6

    # loopback only, on both IPv4 and IPv6, because macOS resolves "localhost" to ::1 first
    servers = [http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)]
    try:
        servers.append(V6(("::1", port), handler))
    except OSError:
        pass
    print(f"Serving {ROOT} at http://localhost:{port}/ (no-store)", flush=True)
    for srv in servers[1:]:
        threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        servers[0].serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
