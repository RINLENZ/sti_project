"""initial_schema

Revision ID: 0957aae01d92
Revises: 
Create Date: 2026-05-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0957aae01d92'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all tables (idempotent via checkfirst=True)."""
    import sys, os
    sys.path.insert(0, '/app')
    from app.database import Base, engine
    import app.models.cours
    import app.models.user
    import app.models.session
    import app.models.interaction
    import app.models.referentiel
    import app.models.examen
    Base.metadata.create_all(engine, checkfirst=True)


def downgrade() -> None:
    pass
