"""add_kcs_to_exercices

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-26

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "ALTER TABLE exercices ADD COLUMN IF NOT EXISTS kcs JSONB"
    ))
    # Backfill : exercices existants → kcs = [competence_evaluee]
    conn.execute(sa.text("""
        UPDATE exercices
        SET kcs = jsonb_build_array(competence_evaluee)
        WHERE kcs IS NULL
          AND competence_evaluee IS NOT NULL
          AND competence_evaluee <> ''
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE exercices DROP COLUMN IF EXISTS kcs"))
