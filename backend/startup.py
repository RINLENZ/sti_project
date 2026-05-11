"""
Startup script for Render deployment.
Always sets alembic_version to match the ACTUAL DB schema state, then runs
alembic upgrade head. Handles both cases:
  - stamp behind schema (partial migration applied manually)
  - stamp ahead of schema (column was never created despite version record)
"""
import os
import sys
import subprocess
import sqlalchemy as sa

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
    """Return the highest revision that is fully reflected in the DB schema."""
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

        # 1. Create alembic_version table if missing
        if not table_exists(conn, "alembic_version"):
            print("[startup] alembic_version missing — creating it")
            conn.execute(sa.text(
                "CREATE TABLE alembic_version "
                "(version_num VARCHAR(32) NOT NULL, "
                "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
            ))
            conn.commit()

        # 2. Determine what the DB schema actually looks like
        actual_stamp = detect_actual_stamp(conn)
        print(f"[startup] Actual schema state → {actual_stamp}")

        # 3. Always sync alembic_version to match reality (advance OR rollback)
        #    This prevents Alembic from skipping migrations whose stamp was
        #    recorded but whose schema changes were never actually applied.
        if actual_stamp:
            rows = conn.execute(
                sa.text("SELECT version_num FROM alembic_version")
            ).fetchall()
            recorded = rows[0][0] if rows else None

            if recorded != actual_stamp:
                if recorded is None:
                    print(f"[startup] alembic_version empty — stamping to {actual_stamp}")
                    conn.execute(
                        sa.text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
                        {"v": actual_stamp}
                    )
                else:
                    print(f"[startup] Syncing alembic_version: {recorded} → {actual_stamp}")
                    conn.execute(
                        sa.text("UPDATE alembic_version SET version_num = :v"),
                        {"v": actual_stamp}
                    )
                conn.commit()
            else:
                print(f"[startup] alembic_version already correct at {recorded}")

        current = [r[0] for r in conn.execute(
            sa.text("SELECT version_num FROM alembic_version")
        ).fetchall()]
        print(f"[startup] alembic_version = {current}")

    # Inline migrations for columns that can't use alembic files (root-owned dir)
    with engine.connect() as conn:
        if not column_exists(conn, 'exercices', 'groupe'):
            print("[startup] Adding 'groupe' column to exercices table")
            conn.execute(sa.text('ALTER TABLE exercices ADD COLUMN groupe INTEGER'))
            conn.commit()
        else:
            print("[startup] 'groupe' column already exists — OK")

        if not column_exists(conn, 'exercices', 'groupe_titre'):
            print("[startup] Adding 'groupe_titre' column to exercices table")
            conn.execute(sa.text('ALTER TABLE exercices ADD COLUMN groupe_titre VARCHAR(200)'))
            conn.commit()
        else:
            print("[startup] 'groupe_titre' column already exists — OK")

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
