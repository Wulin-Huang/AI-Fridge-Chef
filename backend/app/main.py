import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import ingredients, kitchen, planner, recipes

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="AI 冰箱菜谱助手", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingredients.router)
app.include_router(recipes.router)
app.include_router(planner.router)
app.include_router(kitchen.router)


@app.on_event("startup")
def init_db():
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ai-fridge-chef"}
