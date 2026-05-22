import asyncio
from typing import Dict, Set
from fastapi import WebSocket

# ── Gestionnaire de sessions live (par salle) ─────────────────────

class LiveRoomManager:
    """Gère les connexions WebSocket pour les cours en direct (room_id → {user_id: ws})."""

    def __init__(self):
        self._rooms: Dict[str, Dict[str, WebSocket]] = {}

    async def join(self, room_id: str, user_id: str, ws: WebSocket):
        await ws.accept()
        self._rooms.setdefault(room_id, {})[user_id] = ws

    def leave(self, room_id: str, user_id: str):
        room = self._rooms.get(room_id, {})
        room.pop(user_id, None)
        if not room:
            self._rooms.pop(room_id, None)

    def count(self, room_id: str) -> int:
        return len(self._rooms.get(room_id, {}))

    def user_ids(self, room_id: str) -> list[str]:
        return list(self._rooms.get(room_id, {}).keys())

    def is_in_room(self, room_id: str, user_id: str) -> bool:
        return user_id in self._rooms.get(room_id, {})

    async def broadcast(self, room_id: str, data: dict, exclude: str | None = None):
        room = dict(self._rooms.get(room_id, {}))
        dead = []
        for uid, ws in room.items():
            if uid == exclude:
                continue
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.leave(room_id, uid)

    async def send_to(self, room_id: str, user_id: str, data: dict):
        ws = self._rooms.get(room_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.leave(room_id, user_id)


live_manager = LiveRoomManager()


# ── Gestionnaire de notifications personnelles ────────────────────

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
