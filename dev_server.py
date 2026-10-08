from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent

class ShareAwareHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if urlsplit(self.path).path.startswith('/share/'):
            self.path = '/index.html'
        super().do_GET()

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8000), ShareAwareHandler)
    print('拾念开发服务：http://localhost:8000 （Ctrl+C 停止）')
    server.serve_forever()
