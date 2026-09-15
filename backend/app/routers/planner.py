import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import prompts
from ..database import get_db
from ..deepseek import DeepSeekError, chat_json, creative_temperature
from ..models import SavedPlan
from ..schemas import GroceryRequest, MealPlanRequest, SavedPlanIn

router = APIRouter(prefix="/api/planner", tags=["planner"])


@router.post("/meal-plan")
def generate_meal_plan(body: MealPlanRequest):
    """AI 实时生成多日菜单（支持自定义餐次）。"""
    ingredients = [i.strip() for i in body.ingredients if i.strip()]
    system, user = prompts.meal_plan_prompt(
        ingredients=ingredients,
        days=body.days,
        servings=body.servings,
        preferences=body.preferences,
        meals=body.meals or None,
    )
    try:
        return chat_json(system, user, temperature=creative_temperature(0.9), max_tokens=6000)
    except DeepSeekError as exc:
        raise HTTPException(503, str(exc)) from exc


@router.post("/groceries")
def generate_groceries(body: GroceryRequest):
    """AI 对比目标菜品与现有食材，生成购物清单。"""
    system, user = prompts.grocery_prompt(
        target_dishes=[d.strip() for d in body.target_dishes if d.strip()],
        current_ingredients=[i.strip() for i in body.current_ingredients if i.strip()],
    )
    try:
        return chat_json(system, user, temperature=0.7, max_tokens=3000)
    except DeepSeekError as exc:
        raise HTTPException(503, str(exc)) from exc


@router.post("/saved-plans")
def save_plan(body: SavedPlanIn, db: Session = Depends(get_db)):
    row = SavedPlan(title=body.title.strip()[:64], payload=json.dumps(body.payload, ensure_ascii=False))
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.get("/saved-plans")
def list_saved_plans(db: Session = Depends(get_db)):
    rows = db.query(SavedPlan).order_by(SavedPlan.created_at.desc()).all()
    return [
        {"id": r.id, "title": r.title, "payload": json.loads(r.payload), "created_at": r.created_at.isoformat()}
        for r in rows
    ]


@router.delete("/saved-plans/{plan_id}")
def delete_saved_plan(plan_id: int, db: Session = Depends(get_db)):
    row = db.get(SavedPlan, plan_id)
    if not row:
        raise HTTPException(404, "菜单不存在")
    db.delete(row)
    db.commit()
    return {"ok": True}
