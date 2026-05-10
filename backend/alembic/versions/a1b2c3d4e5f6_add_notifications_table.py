"""add_notifications_table

Revision ID: a1b2c3d4e5f6
Revises: 0957aae01d92
Create Date: 2026-05-10

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '0957aae01d92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text('''
        CREATE TABLE IF NOT EXISTS notifications (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type       VARCHAR NOT NULL,
            titre      VARCHAR NOT NULL,
            message    VARCHAR NOT NULL,
            lu         BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT now(),
            meta       JSONB
        )
    '''))
    conn.execute(sa.text(
        'CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id)'
    ))
    conn.execute(sa.text(
        'CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications (created_at)'
    ))


def downgrade() -> None:
    op.drop_index('ix_notifications_created_at', table_name='notifications')
    op.drop_index('ix_notifications_user_id',    table_name='notifications')
    op.drop_table('notifications')
