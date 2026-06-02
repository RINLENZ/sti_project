"""add_engagement_per_exercice_to_progressions

Revision ID: f6a7b8c9d0e1
Revises: d4e5f6a7b8c9
Create Date: 2026-05-30

Ajoute 4 colonnes d'engagement per-exercice sur la table progressions.
Granularité temporelle nécessaire pour DKT-E : une valeur par exercice
plutôt qu'un score agrégé constant par session.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "ALTER TABLE progressions ADD COLUMN IF NOT EXISTS engagement_fused      FLOAT"
    ))
    conn.execute(sa.text(
        "ALTER TABLE progressions ADD COLUMN IF NOT EXISTS engagement_facial     FLOAT"
    ))
    conn.execute(sa.text(
        "ALTER TABLE progressions ADD COLUMN IF NOT EXISTS engagement_audio      FLOAT"
    ))
    conn.execute(sa.text(
        "ALTER TABLE progressions ADD COLUMN IF NOT EXISTS engagement_behavioral FLOAT"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE progressions DROP COLUMN IF EXISTS engagement_fused"))
    conn.execute(sa.text("ALTER TABLE progressions DROP COLUMN IF EXISTS engagement_facial"))
    conn.execute(sa.text("ALTER TABLE progressions DROP COLUMN IF EXISTS engagement_audio"))
    conn.execute(sa.text("ALTER TABLE progressions DROP COLUMN IF EXISTS engagement_behavioral"))
