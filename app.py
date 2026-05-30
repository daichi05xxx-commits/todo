import http.server
import json
import uuid
import threading
import webbrowser
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, parse_qs

PORT = 5000
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
DATA_FILE = BASE_DIR / "todos.json"
LOCK = threading.Lock()

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}


def load_todos():
    with LOCK:
        if not DATA_FILE.exists():
            return []
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def save_todos(todos):
    with LOCK:
        DATA_FILE.write_text(
            json.dumps(todos, ensure_ascii=False, indent=2), encoding="utf-8"
        )


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _send(self, status, ctype, body):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, data, status=200):
        self._send(status, "application/json; charset=utf-8",
                   json.dumps(data, ensure_ascii=False))

    def _no_content(self):
        self.send_response(204)
        self.end_headers()

    def _read_body(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n).decode("utf-8")) if n else {}

    def _parts(self):
        return urlparse(self.path).path.strip("/").split("/")

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ("/", "/index.html"):
            self._send(200, MIME[".html"], (STATIC_DIR / "index.html").read_bytes())
            return

        if path.startswith("/static/"):
            f = STATIC_DIR / path[len("/static/"):]
            if not f.exists():
                self._send(404, "text/plain", "Not Found")
                return
            self._send(200, MIME.get(f.suffix, "application/octet-stream"), f.read_bytes())
            return

        if path == "/api/todos":
            self._json(load_todos())
            return

        self._send(404, "text/plain", "Not Found")

    def do_POST(self):
        if self.path != "/api/todos":
            self._send(404, "text/plain", "Not Found")
            return

        data = self._read_body()
        title = (data.get("title") or "").strip()
        if not title:
            self._json({"error": "タイトルは必須です"}, 400)
            return

        todo = {
            "id": str(uuid.uuid4()),
            "title": title,
            "description": (data.get("description") or "").strip(),
            "completed": False,
            "priority": data.get("priority", "medium"),
            "category": (data.get("category") or "").strip(),
            "due_date": data.get("due_date", ""),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        todos = load_todos()
        todos.insert(0, todo)
        save_todos(todos)
        self._json(todo, 201)

    def do_PUT(self):
        parts = self._parts()
        if len(parts) != 3 or parts[:2] != ["api", "todos"]:
            self._send(404, "text/plain", "Not Found")
            return

        todo_id = parts[2]
        data = self._read_body()
        todos = load_todos()

        for i, todo in enumerate(todos):
            if todo["id"] != todo_id:
                continue
            if "title" in data:
                if not str(data["title"]).strip():
                    self._json({"error": "タイトルは空にできません"}, 400)
                    return
                todo["title"] = str(data["title"]).strip()
            for field in ("description", "category", "due_date", "priority"):
                if field in data:
                    todo[field] = data[field]
            if "completed" in data:
                todo["completed"] = bool(data["completed"])
            todo["updated_at"] = datetime.now().isoformat()
            todos[i] = todo
            save_todos(todos)
            self._json(todo)
            return

        self._json({"error": "見つかりません"}, 404)

    def do_DELETE(self):
        parts = self._parts()
        if len(parts) != 3 or parts[:2] != ["api", "todos"]:
            self._send(404, "text/plain", "Not Found")
            return

        target = parts[2]
        todos = load_todos()

        if target == "completed":
            save_todos([t for t in todos if not t["completed"]])
            self._json({"ok": True})
        else:
            new_todos = [t for t in todos if t["id"] != target]
            if len(new_todos) == len(todos):
                self._json({"error": "見つかりません"}, 404)
                return
            save_todos(new_todos)
            self._no_content()


def main():
    # "" で全インターフェース（IPv4/IPv6 両対応）にバインド
    server = http.server.HTTPServer(("", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"TODO アプリを起動しました")
    print(f"  ブラウザで開く → {url}")
    print(f"  終了するには Ctrl+C を押してください")
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nサーバーを停止しました")


if __name__ == "__main__":
    main()
