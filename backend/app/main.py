import asyncio

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import redis as redis_lib
import sqlalchemy as sa
import time
from .config import settings
from .database import Base, engine
from .routers import auth
from .routers import interactions
from .models import cours
from .models import examen as _examen_models         # noqa: F401 — registers tables
from .models import notification as _notif_models    # noqa: F401 — registers tables
from .models import chat as _chat_models             # noqa: F401 — registers tables
from .routers import cours
from .routers import bkt
from .routers import admin
from .routers import tuteur
from .routers import annotation
from .routers import examen
from .routers import notifications
from .routers import ws as ws_router
from .routers import chat as chat_router

app = FastAPI(
    title="STI Adaptatif — API",
    description="Système de Tutorat Intelligent avec analyse multimodale",
    version="0.1.0"
)


@app.on_event("startup")
async def init_ws_loop():
    """Initialise la boucle asyncio pour les push WebSocket depuis les services sync."""
    from .ws_manager import init_loop
    init_loop(asyncio.get_event_loop())

@app.on_event("startup")
def create_missing_tables():
    """Crée toutes les tables manquantes et applique les migrations DDL idempotentes."""
    Base.metadata.create_all(bind=engine, checkfirst=True)
    # Migrations DDL idempotentes (ALTER TYPE hors transaction PostgreSQL)
    with engine.connect() as conn:
        conn.execute(sa.text("COMMIT"))
        conn.execute(sa.text("ALTER TYPE exercice_type ADD VALUE IF NOT EXISTS 'vrai_faux'"))
        conn.execute(sa.text("COMMIT"))
        conn.execute(sa.text("ALTER TYPE statut_enum ADD VALUE IF NOT EXISTS 'en_attente_correction'"))
        conn.execute(sa.text("COMMIT"))
        conn.execute(sa.text(
            "ALTER TABLE progressions ADD COLUMN IF NOT EXISTS commentaire_enseignant TEXT"
        ))
        # Convertit JSON → JSONB pour les colonnes de chat (si table déjà existante)
        conn.execute(sa.text("""
            DO $$ BEGIN
                IF EXISTS (SELECT FROM information_schema.columns
                           WHERE table_name='chat_rooms' AND column_name='membres'
                           AND data_type='json') THEN
                    ALTER TABLE chat_rooms ALTER COLUMN membres TYPE JSONB USING membres::text::jsonb;
                END IF;
            END $$;
        """))
        conn.execute(sa.text("""
            DO $$ BEGIN
                IF EXISTS (SELECT FROM information_schema.columns
                           WHERE table_name='chat_messages' AND column_name='lu_par'
                           AND data_type='json') THEN
                    ALTER TABLE chat_messages ALTER COLUMN lu_par TYPE JSONB USING lu_par::text::jsonb;
                END IF;
            END $$;
        """))
        # Indexes pour les requêtes fréquentes
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_progressions_user ON progressions(user_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_progressions_ua ON progressions(ua_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON learning_sessions(user_id, started_at DESC)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_chat_msgs_room ON chat_messages(room_id, created_at DESC)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_bkt_user ON bkt_mastery(user_id, competence)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_ep_rep_epreuve ON epreuve_reponses(epreuve_id, statut)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_ep_rep_apprenant ON epreuve_reponses(apprenant_id)"))
        conn.execute(sa.text("ALTER TABLE epreuves ADD COLUMN IF NOT EXISTS date_ouverture TIMESTAMP WITH TIME ZONE"))
        conn.execute(sa.text("ALTER TABLE epreuves ADD COLUMN IF NOT EXISTS date_cloture   TIMESTAMP WITH TIME ZONE"))
        # Colonnes pour les copies papier et le dataset d'entraînement
        conn.execute(sa.text("ALTER TABLE epreuve_reponses ADD COLUMN IF NOT EXISTS copie_type VARCHAR(20) DEFAULT 'numerique'"))
        conn.execute(sa.text("ALTER TABLE epreuve_reponses ADD COLUMN IF NOT EXISTS image_copie_url TEXT"))
        conn.execute(sa.text("ALTER TABLE epreuve_reponses ADD COLUMN IF NOT EXISTS vision_corrections JSON"))
        conn.execute(sa.text("ALTER TABLE epreuve_reponses ADD COLUMN IF NOT EXISTS dataset_valide BOOLEAN DEFAULT FALSE"))
        conn.execute(sa.text("COMMIT"))

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

app.add_middleware(GZipMiddleware, minimum_size=512)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # En dev : tout port localhost est autorisé (Vite peut changer de port)
    allow_origin_regex=r"http://localhost:\d+" if settings.environment == "development" else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

# Servir les copies papier uploadées
import os as _os
_os.makedirs("static/copies", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(auth.router)
app.include_router(interactions.router)
app.include_router(cours.router)
app.include_router(tuteur.router)
app.include_router(bkt.router)
app.include_router(admin.router)
app.include_router(annotation.router)
app.include_router(examen.router)
app.include_router(notifications.router)
app.include_router(ws_router.router)
app.include_router(chat_router.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}

@app.get("/")
def root():
    return {"message": "API STI Adaptatif opérationnelle"}