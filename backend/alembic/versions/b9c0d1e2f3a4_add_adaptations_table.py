"""add adaptations table

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-06-13

Crée la table adaptations qui logge chaque intervention pédagogique
déclenchée par le moteur d'adaptation multimodale.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic
revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, None] = "a8b9c0d1e2f3"  # is_synthetic users
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "adaptations",
        sa.Column("id", postgresql.UUID(as_uuid=True),
                  primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id",    postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("timestamp",  sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("declencheur", sa.String(64), nullable=False),
        sa.Column("action",      sa.String(64), nullable=False),
        sa.Column("intensite",   sa.String(16), nullable=False),
        sa.Column("signal_data", postgresql.JSONB, nullable=True),
        sa.Column("applique",    sa.Boolean, server_default="false", nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["learning_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"],    ["users.id"],    ondelete="CASCADE"),
    )

    # Indexes pour les requêtes fréquentes
    op.create_index("ix_adaptations_user_id",      "adaptations", ["user_id"])
    op.create_index("ix_adaptations_session_id",   "adaptations", ["session_id"])
    op.create_index("ix_adaptations_timestamp",    "adaptations", ["timestamp"])
    op.create_index("ix_adaptations_declencheur",  "adaptations", ["declencheur"])

    # Contrainte de validation sur intensite
    op.create_check_constraint(
        "ck_adaptations_intensite",
        "adaptations",
        "intensite IN ('haute', 'moyenne', 'basse')",
    )


def downgrade() -> None:
    op.drop_index("ix_adaptations_declencheur", table_name="adaptations")
    op.drop_index("ix_adaptations_timestamp",   table_name="adaptations")
    op.drop_index("ix_adaptations_session_id",  table_name="adaptations")
    op.drop_index("ix_adaptations_user_id",     table_name="adaptations")
    op.drop_table("adaptations")
