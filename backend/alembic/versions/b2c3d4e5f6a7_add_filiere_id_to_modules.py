"""add_filiere_id_to_modules

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-10

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('modules',
        sa.Column('filiere_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'modules_filiere_id_fkey', 'modules', 'filieres',
        ['filiere_id'], ['id'], ondelete='SET NULL'
    )
    op.create_index('ix_modules_filiere_id', 'modules', ['filiere_id'])


def downgrade() -> None:
    op.drop_index('ix_modules_filiere_id', table_name='modules')
    op.drop_constraint('modules_filiere_id_fkey', 'modules', type_='foreignkey')
    op.drop_column('modules', 'filiere_id')
