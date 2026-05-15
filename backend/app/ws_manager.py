import asyncio
from typing import Dict, Set
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self._connections.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self._connections:
            self._connections[user_id].discard(ws)
            if not self._connections[user_id]:
                del self._connections[user_id]

    async def send_to_user(self, user_id: str, data: dict):
        conns = list(self._connections.get(str(user_id), set()))
        dead = []
        for ws in conns:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(str(user_id), ws)

    async def broadcast_to_users(self, user_ids: list, data: dict):
        tasks = [self.send_to_user(str(uid), data) for uid in user_ids]
        await asyncio.gather(*tasks, return_exceptions=True)

    def is_online(self, user_id: str) -> bool:
        return bool(self._connections.get(str(user_id)))


manager = ConnectionManager()

# Référence à la boucle principale (initialisée au démarrage)
_main_loop: asyncio.AbstractEventLoop | None = None

def init_loop(loop: asyncio.AbstractEventLoop):
    global _main_loop
    _main_loop = loop

def push_to_user(user_id: str, data: dict):
    """Pousse un message WS depuis un contexte synchrone (thread pool)."""
    if _main_loop and not _main_loop.is_closed():
        asyncio.run_coroutine_threadsafe(
            manager.send_to_user(str(user_id), data),
            _main_loop,
        )
