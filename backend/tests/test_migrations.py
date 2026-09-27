import os
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine

from core.database import Base
from conftest import TMP_DIR

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def test_migrations_match_models(monkeypatch):
    url = f"sqlite:///{TMP_DIR}/migrations.db"
    monkeypatch.setattr("core.config.settings.DATABASE_URL", url)
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "migrations"))
    command.upgrade(cfg, "head")

    engine = create_engine(url)
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    engine.dispose()
    assert diff == [], f"Models changed without a migration: {diff}"
