"""
Startup script for Render deployment.
Ensures alembic_version exists and is stamped before running migrations.
Handles databases created directly via create_all() without Alembic tracking.
"""
import os
import sys
import subprocess
import sqlalchemy as sa


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


def main():
    db_url = get_db_url()
    if not db_url:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
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

        # 2. If empty, stamp based on actual schema state so we don't re-run
        #    migrations that were already applied via create_all()
        rows = conn.execute(
            sa.text("SELECT version_num FROM alembic_version")
        ).fetchall()
        current = [r[0] for r in rows]

        if not current:
            if column_exists(conn, "modules", "filiere_id"):
                # filiere_id already in DB — all migrations applied
                stamp = "c3d4e5f6a7b8"
            elif table_exists(conn, "notifications"):
                # notifications exists but filiere_id not yet added
                stamp = "a1b2c3d4e5f6"
            elif table_exists(conn, "users"):
                # Only initial schema, no subsequent migrations
                stamp = "0957aae01d92"
            else:
                stamp = None

            if stamp:
                print(f"[startup] Stamping alembic_version → {stamp}")
                conn.execute(
                    sa.text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
                    {"v": stamp}
                )
                conn.commit()
            else:
                print("[startup] Empty DB — letting Alembic run from scratch")

        current = [r[0] for r in conn.execute(
            sa.text("SELECT version_num FROM alembic_version")
        ).fetchall()]
        print(f"[startup] alembic_version = {current}")

    engine.dispose()

    # 3. Run alembic upgrade head to apply any pending migrations
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
