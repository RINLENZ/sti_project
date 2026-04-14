from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routers import auth
from .routers import interactions
from .models import cours
from .routers import cours 

# Crée les tables au démarrage (en dev ; en prod on utilise Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="STI Adaptatif — API",
    description="Système de Tutorat Intelligent avec analyse multimodale",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(interactions.router)
app.include_router(cours.router) 

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}

@app.get("/")
def root():
    return {"message": "API STI Adaptatif opérationnelle"}