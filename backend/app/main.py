from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import redis as redis_lib
import time
from .config import settings
from .database import Base, engine
from .routers import auth
from .routers import interactions
from .models import cours
from .routers import cours
from .routers import bkt
from .routers import admin
from .routers import tuteur
from .routers import annotation

# Crée les tables au démarrage (en dev ; en prod on utilise Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="STI Adaptatif — API",
    description="Système de Tutorat Intelligent avec analyse multimodale",
    version="0.1.0"
)

# ── Rate limiting middleware (Redis sliding window) ───────────────
try:
    _redis = redis_lib.from_url(settings.redis_url, decode_responses=True)
    _redis.ping()
    _rate_limit_enabled = True
except Exception:
    _rate_limit_enabled = False

RATE_LIMITS = {
    "/auth/login":    (10, 60),   # 10 req / 60s
    "/auth/register": (5,  60),   # 5 req  / 60s
}

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if _rate_limit_enabled and request.url.path in RATE_LIMITS:
        limit, window = RATE_LIMITS[request.url.path]
        ip  = request.client.host if request.client else "unknown"
        key = f"rl:{request.url.path}:{ip}"
        now = int(time.time())
        pipe = _redis.pipeline()
        pipe.zremrangebyscore(key, 0, now - window)
        pipe.zadd(key, {str(now) + str(time.time()): now})
        pipe.zcard(key)
        pipe.expire(key, window)
        results = pipe.execute()
        count = results[2]
        if count > limit:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Trop de requêtes. Réessayez dans {window}s."}
            )
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(interactions.router)
app.include_router(cours.router)
app.include_router(tuteur.router)
app.include_router(bkt.router)
app.include_router(admin.router)
app.include_router(annotation.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}

@app.get("/")
def root():
    return {"message": "API STI Adaptatif opérationnelle"}