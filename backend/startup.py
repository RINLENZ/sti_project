"""
Startup script for Render deployment.
Always syncs alembic_version with the ACTUAL DB schema state before running
alembic upgrade head — prevents failures when a column was partially added
by a previous deployment attempt but alembic_version was never updated.
"""
import os
import sys
import subprocess
import sqlalchemy as sa

# Ordered list of all migration revisions (oldest → newest)
MIGRATION_ORDER = [
    "0957aae01d92",  # initial schema
    "a1b2c3d4e5f6",  # add notifications table
    "b2c3d4e5f6a7",  # add filiere_id to modules
    "c3d4e5f6a7b8",  # add filiere_id idempotent (no-op after b2c3)
]


def get_db_url():
    url = os.getenv("DATABASE_URL", "")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def table_exists(conn, name):
    return conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=:t)"
    ), {"t": name}).scalar()


def column_exists(conn, table, column):
    return conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=:t AND column_name=:c)"
    ), {"t": table, "c": column}).scalar()


def detect_actual_stamp(conn):
    """Determine the highest migration that has already been applied to the DB."""
    if column_exists(conn, "modules", "filiere_id"):
        return "c3d4e5f6a7b8"
    if table_exists(conn, "notifications"):
        return "a1b2c3d4e5f6"
    if table_exists(conn, "users"):
        return "0957aae01d92"
    return None


def main():
    db_url = get_db_url()
    if not db_url:
        print("[startup] ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    engine = sa.create_engine(db_url)
    with engine.connect() as conn:

        # 1. Create alembic_version table if it was never created by Alembic
        if not table_exists(conn, "alembic_version"):
            print("[startup] alembic_version missing — creating it")
            conn.execute(sa.text(
                "CREATE TABLE alembic_version "
                "(version_num VARCHAR(32) NOT NULL, "
                "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
            ))
            conn.commit()

        # 2. Determine what the DB actually looks like right now
        actual_stamp = detect_actual_stamp(conn)
        print(f"[startup] Actual schema state → {actual_stamp}")

        # 3. Sync alembic_version to match reality (only advance, never go back)
        if actual_stamp:
            rows = conn.execute(
                sa.text("SELECT version_num FROM alembic_version")
            ).fetchall()
            recorded = rows[0][0] if rows else None

            actual_idx   = MIGRATION_ORDER.index(actual_stamp) if actual_stamp in MIGRATION_ORDER else -1
            recorded_idx = MIGRATION_ORDER.index(recorded)     if recorded in MIGRATION_ORDER else -1

            if recorded is None:
                print(f"[startup] alembic_version empty — stamping to {actual_stamp}")
                conn.execute(
                    sa.text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
                    {"v": actual_stamp}
                )
                conn.commit()
            elif actual_idx > recorded_idx:
                # Schema is ahead of what alembic thinks (partial migration ran)
                print(f"[startup] Schema ahead of alembic ({recorded} → {actual_stamp}) — updating stamp")
                conn.execute(
                    sa.text("UPDATE alembic_version SET version_num = :v"),
                    {"v": actual_stamp}
                )
                conn.commit()
            else:
                print(f"[startup] alembic_version already at {recorded} — no change needed")

        current = [r[0] for r in conn.execute(
            sa.text("SELECT version_num FROM alembic_version")
        ).fetchall()]
        print(f"[startup] alembic_version = {current}")

    engine.dispose()

    # 4. Run alembic upgrade head to apply any remaining migrations
    print("[startup] Running alembic upgrade head …")
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
    )
    if result.returncode != 0:
        print("[startup] ERROR: alembic upgrade head failed", file=sys.stderr)
        sys.exit(1)

    print("[startup] Done — all migrations applied.")


if __name__ == "__main__":
    main()
