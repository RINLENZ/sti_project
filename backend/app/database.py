from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

engine = create_engine(
    settings.database_url,
    pool_size=5,          # connexions persistantes
    max_overflow=10,      # connexions supplémentaires si pool saturé
    pool_timeout=30,      # attente max avant erreur
    pool_pre_ping=True,   # vérifie que la connexion est vivante (évite les drops Render)
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()