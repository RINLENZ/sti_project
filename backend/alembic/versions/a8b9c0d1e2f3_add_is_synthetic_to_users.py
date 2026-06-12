"""add_is_synthetic_to_users

Revision ID: a8b9c0d1e2f3
Revises: f6a7b8c9d0e1
Create Date: 2026-06-11

Ajoute le champ booléen `is_synthetic` à la table users.
But : marquer les apprenants générés par seed_dkt_simulations.py
afin de les exclure proprement de l'évaluation finale du DKT.
Tous les utilisateurs existants reçoivent FALSE par défaut.
Migration idempotente — peut être rejouée sans dommage.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a8b9c0d1e2f3'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # IF NOT EXISTS rend la migration idempotente
    conn.execute(sa.text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT FALSE"
    ))
    # Index partiel sur is_synthetic=TRUE — utile pour les requêtes de cleanup
    # et pour les filtres "exclure les synthétiques" dans l'évaluation finale.
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_users_is_synthetic_true "
        "ON users (is_synthetic) WHERE is_synthetic = TRUE"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_is_synthetic_true"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS is_synthetic"))
