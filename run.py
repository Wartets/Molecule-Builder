# run.py
import http.server
import socketserver

PORT = 8000

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print("Serveur démarré sur http://localhost:" + str(PORT))
    httpd.serve_forever()