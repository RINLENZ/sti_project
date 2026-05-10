"""add_filiere_id_idempotent

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-10

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        'ALTER TABLE modules ADD COLUMN IF NOT EXISTS filiere_id UUID'
    ))
    conn.execute(sa.text('''
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = \'modules_filiere_id_fkey\'
                AND table_name = \'modules\'
            ) THEN
                ALTER TABLE modules ADD CONSTRAINT modules_filiere_id_fkey
                    FOREIGN KEY (filiere_id) REFERENCES filieres(id) ON DELETE SET NULL;
            END IF;
        END $$
    '''))
    conn.execute(sa.text(
        'CREATE INDEX IF NOT EXISTS ix_modules_filiere_id ON modules (filiere_id)'
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text('DROP INDEX IF EXISTS ix_modules_filiere_id'))
    conn.execute(sa.text(
        'ALTER TABLE modules DROP CONSTRAINT IF EXISTS modules_filiere_id_fkey'
    ))
    conn.execute(sa.text(
        'ALTER TABLE modules DROP COLUMN IF EXISTS filiere_id'
    ))
