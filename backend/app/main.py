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
from .models import cours_live as _cours_live_models # noqa: F401 — registers tables
from .routers import cours
from .routers import bkt
from .routers import admin
from .routers import tuteur
from .routers import annotation
from .routers import examen
from .routers import notifications
from .routers import ws as ws_router
from .routers import chat as chat_router
from .routers import training as training_router
from .routers import cours_live as cours_live_router
from .routers import tts as tts_router
from .routers import gamification as gamification_router
from .models import user_stats as _user_stats_models   # noqa: F401 — registers table

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
    """Crée les tables manquantes et applique les migrations DDL idempotentes.

    Stratégie anti-timeout Supabase :
    - On consulte information_schema / pg_indexes (lecture seule, aucun lock)
      AVANT chaque ALTER TABLE / CREATE INDEX.
    - Si la colonne/l'index existe déjà → on saute le DDL complètement.
    - Seules les colonnes vraiment absentes déclenchent un ALTER TABLE
      (typiquement lors du tout premier déploiement sur une DB vierge).
    - Résultat : après le premier déploiement réussi, le startup DDL
      s'exécute en < 200 ms sans aucun lock sur les tables.
    """
    import logging as _log
    _ddl = _log.getLogger(__name__)

    try:
        Base.metadata.create_all(bind=engine, checkfirst=True)
    except Exception as _e:
        _ddl.warning("create_all incomplet : %s", _e)

    def _col(conn, table: str, col: str) -> bool:
        """Retourne True si la colonne existe déjà (lecture seule, sans lock)."""
        r = conn.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name=:t AND column_name=:c"
        ), {"t": table, "c": col}).fetchone()
        return r is not None

    def _idx(conn, name: str) -> bool:
        """Retourne True si l'index existe déjà."""
        r = conn.execute(sa.text(
            "SELECT 1 FROM pg_indexes WHERE indexname=:i"
        ), {"i": name}).fetchone()
        return r is not None

    def _run(conn, sql: str, label: str = ""):
        """Exécute un DDL et absorbe l'erreur sans tuer le démarrage."""
        try:
            conn.execute(sa.text(sql))
        except Exception as _e:
            _ddl.warning("DDL échoué (%s) : %s", label or sql[:60], _e)
            try:
                conn.execute(sa.text("ROLLBACK"))
            except Exception:
                pass

    with engine.connect() as conn:

        # ── ALTER TYPE hors transaction (idempotent côté PG) ──────────
        _run(conn, "COMMIT")
        _run(conn, "ALTER TYPE exercice_type ADD VALUE IF NOT EXISTS 'vrai_faux'", "exercice_type")
        _run(conn, "COMMIT")
        _run(conn, "ALTER TYPE statut_enum ADD VALUE IF NOT EXISTS 'en_attente_correction'", "statut_enum")
        _run(conn, "COMMIT")

        # ── ADD COLUMN : vérifie d'abord, exécute seulement si absent ─
        _COLS = [
            # (table, colonne, définition SQL)
            ("progressions",      "commentaire_enseignant", "TEXT"),
            ("progressions",      "session_id",             "UUID REFERENCES learning_sessions(id) ON DELETE SET NULL"),
            ("progressions",      "engagement_fused",       "FLOAT"),
            ("progressions",      "engagement_facial",      "FLOAT"),
            ("progressions",      "engagement_audio",       "FLOAT"),
            ("progressions",      "engagement_behavioral",  "FLOAT"),
            ("epreuves",          "date_ouverture",         "TIMESTAMP WITH TIME ZONE"),
            ("epreuves",          "date_cloture",           "TIMESTAMP WITH TIME ZONE"),
            ("epreuve_reponses",  "copie_type",             "VARCHAR(20) DEFAULT 'numerique'"),
            ("epreuve_reponses",  "image_copie_url",        "TEXT"),
            ("epreuve_reponses",  "vision_corrections",     "JSON"),
            ("epreuve_reponses",  "dataset_valide",         "BOOLEAN DEFAULT FALSE"),
            ("learning_sessions", "score_facial",           "FLOAT"),
            ("learning_sessions", "score_audio",            "FLOAT"),
            ("learning_sessions", "score_comportemental",   "FLOAT"),
            # user_stats — table créée via create_all, colonnes ici pour sécurité
            ("user_stats",        "total_sessions",         "INTEGER NOT NULL DEFAULT 0"),
            ("user_stats",        "total_exercices",        "INTEGER NOT NULL DEFAULT 0"),
            ("user_stats",        "total_corrects",         "INTEGER NOT NULL DEFAULT 0"),
        ]
        for _t, _c, _typedef in _COLS:
            if not _col(conn, _t, _c):
                _run(conn, f"ALTER TABLE {_t} ADD COLUMN {_c} {_typedef}", f"{_t}.{_c}")

        # ── JSON → JSONB chat (conditionnel côté PG, pas de lock si déjà JSONB) ─
        _run(conn, """DO $$ BEGIN
            IF EXISTS (SELECT FROM information_schema.columns
                       WHERE table_name='chat_rooms' AND column_name='membres'
                       AND data_type='json') THEN
                ALTER TABLE chat_rooms ALTER COLUMN membres TYPE JSONB USING membres::text::jsonb;
            END IF;
        END $$;""", "chat_rooms.membres→jsonb")
        _run(conn, """DO $$ BEGIN
            IF EXISTS (SELECT FROM information_schema.columns
                       WHERE table_name='chat_messages' AND column_name='lu_par'
                       AND data_type='json') THEN
                ALTER TABLE chat_messages ALTER COLUMN lu_par TYPE JSONB USING lu_par::text::jsonb;
            END IF;
        END $$;""", "chat_messages.lu_par→jsonb")

        # ── CREATE INDEX : vérifie d'abord ────────────────────────────
        _INDEXES = [
            ("idx_progressions_user",    "CREATE INDEX idx_progressions_user ON progressions(user_id)"),
            ("idx_progressions_ua",      "CREATE INDEX idx_progressions_ua ON progressions(ua_id)"),
            ("idx_sessions_user_date",   "CREATE INDEX idx_sessions_user_date ON learning_sessions(user_id, started_at DESC)"),
            ("idx_chat_msgs_room",       "CREATE INDEX idx_chat_msgs_room ON chat_messages(room_id, created_at DESC)"),
            ("idx_bkt_user",             "CREATE INDEX idx_bkt_user ON bkt_mastery(user_id, competence)"),
            ("idx_ep_rep_epreuve",       "CREATE INDEX idx_ep_rep_epreuve ON epreuve_reponses(epreuve_id, statut)"),
            ("idx_ep_rep_apprenant",     "CREATE INDEX idx_ep_rep_apprenant ON epreuve_reponses(apprenant_id)"),
            ("ix_progressions_session_id", "CREATE INDEX ix_progressions_session_id ON progressions(session_id)"),
        ]
        for _name, _sql in _INDEXES:
            if not _idx(conn, _name):
                _run(conn, _sql, _name)

        _run(conn, "COMMIT")

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
app.include_router(training_router.router)
app.include_router(cours_live_router.router)
app.include_router(tts_router.router)
app.include_router(gamification_router.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}

@app.get("/")
def root():
    return {"message": "API STI Adaptatif opérationnelle"}