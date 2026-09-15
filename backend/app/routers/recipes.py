import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import prompts
from ..database import get_db
from ..deepseek import DeepSeekError, chat_json, chat_json_stream, creative_temperature
from ..models import Favorite
from ..schemas import FavoriteIn, NutritionRequest, RecipeRequest, StyleRequest

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def _require_ingredients(req: RecipeRequest):
    return [i.strip() for i in req.ingredients if i.strip()]


@router.post("/styles")
def suggest_styles(body: StyleRequest):
    """AI 根据现有食材生成今日做菜风格灵感，无固定风格列表。"""
    system, user = prompts.recipe_styles_prompt([i.strip() for i in body.ingredients if i.strip()])
    try:
        return chat_json(system, user, temperature=creative_temperature(1.1), max_tokens=1024)
    except DeepSeekError as exc:
        raise HTTPException(503, str(exc)) from exc


@router.post("/generate")
def generate_recipes(body: RecipeRequest):
    """核心接口：DeepSeek 实时生成菜谱（道数可选）。"""
    ingredients = _require_ingredients(body)
    system, user = prompts.recipe_generate_prompt(
        ingredients=ingredients,
        style=body.style or "由你自由发挥",
        servings=body.servings,
        preferences=body.preferences,
        excluded=body.excluded,
        count=body.count,
    )
    try:
        data = chat_json(system, user, temperature=creative_temperature(1.0))
    except DeepSeekError as exc:
        raise HTTPException(503, str(exc)) from exc
    recipes = data.get("recipes") or []
    if not recipes:
        raise HTTPException(502, "AI 未返回菜谱，请重试")
    return {"recipes": recipes}


@router.post("/generate-stream")
def generate_recipes_stream(body: RecipeRequest):
    """SSE 流式生成菜谱：前端边收边渲染，打字机效果。"""
    ingredients = _require_ingredients(body)
    system, user = prompts.recipe_generate_prompt(
        ingredients=ingredients,
        style=body.style or "由你自由发挥",
        servings=body.servings,
        preferences=body.preferences,
        excluded=body.excluded,
        count=body.count,
    )
    temperature = creative_temperature(1.0)

    def event_stream():
        try:
            for chunk in chat_json_stream(system, user, temperature=temperature):
                yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': f'AI 服务暂时不可用（{exc}）'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/nutrition")
def analyze_nutrition(body: NutritionRequest):
    system, user = prompts.nutrition_prompt(body.recipe_name, body.ingredients_desc, body.servings)
    try:
        return chat_json(system, user, temperature=0.6, max_tokens=2048)
    except DeepSeekError as exc:
        raise HTTPException(503, str(exc)) from exc


@router.post("/favorites")
def add_favorite(body: FavoriteIn, db: Session = Depends(get_db)):
    row = Favorite(
        title=body.title[:128],
        emoji=body.emoji,
        payload=json.dumps(body.payload, ensure_ascii=False),
    )
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.get("/favorites")
def list_favorites(db: Session = Depends(get_db)):
    rows = db.query(Favorite).order_by(Favorite.created_at.desc()).all()
    return [
        {"id": r.id, "title": r.title, "emoji": r.emoji, "payload": json.loads(r.payload)}
        for r in rows
    ]


@router.delete("/favorites/{favorite_id}")
def delete_favorite(favorite_id: int, db: Session = Depends(get_db)):
    row = db.get(Favorite, favorite_id)
    if not row:
        raise HTTPException(404, "收藏不存在")
    db.delete(row)
    db.commit()
    return {"ok": True}
