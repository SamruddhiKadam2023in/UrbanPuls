"""gate attendants

Revision ID: 10d2cf6467a0
Revises: 55cb1e757acf
Create Date: 2026-09-29 07:03:03.962280

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '10d2cf6467a0'
down_revision: Union[str, Sequence[str], None] = '55cb1e757acf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_ROLES = ('user', 'vendor', 'admin', 'police')
NEW_ROLES = OLD_ROLES + ('attendant',)


def upgrade() -> None:
    """Gate attendant role, and the link from an attendant to the Parking Partner who employs them."""
    postgres = op.get_bind().dialect.name == "postgresql"
    if postgres:
        # New enum values cannot be added inside a transaction block on PostgreSQL
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'attendant'")
    with op.batch_alter_table('users', schema=None) as batch_op:
        if not postgres:
            # Elsewhere the enum is a VARCHAR sized to the longest value, which is now "attendant"
            batch_op.alter_column('role', existing_type=sa.Enum(*OLD_ROLES, name='user_role'),
                                  type_=sa.Enum(*NEW_ROLES, name='user_role'), existing_nullable=False)
        batch_op.add_column(sa.Column('employer_id', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_users_employer_id'), ['employer_id'], unique=False)
        batch_op.create_foreign_key('fk_users_employer_id_users', 'users', ['employer_id'], ['id'])


def downgrade() -> None:
    """Attendant accounts become regular users; PostgreSQL cannot drop an enum value, so it stays unused."""
    op.execute("UPDATE users SET role = 'user' WHERE role = 'attendant'")
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('fk_users_employer_id_users', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_users_employer_id'))
        batch_op.drop_column('employer_id')
        if op.get_bind().dialect.name != "postgresql":
            batch_op.alter_column('role', existing_type=sa.Enum(*NEW_ROLES, name='user_role'),
                                  type_=sa.Enum(*OLD_ROLES, name='user_role'), existing_nullable=False)
