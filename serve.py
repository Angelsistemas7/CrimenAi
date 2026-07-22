"""Servidor local para CrimenAI: sirve la carpeta con cabeceras no-cache
para que el navegador siempre pida la última versión de los archivos.
"""
import http.server
import socketserver

PORT = 8541


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    with ReusableTCPServer(('', PORT), NoCacheHandler) as httpd:
        print(f'Sirviendo CrimenAI en http://localhost:{PORT} (sin caché)')
        httpd.serve_forever()
