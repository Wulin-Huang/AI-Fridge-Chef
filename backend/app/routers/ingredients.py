from datetime import date, timedelta

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import prompts
from ..config import MAX_IMAGE_B64_LENGTH
from ..deepseek import DeepSeekError, chat_json, chat_vision_json, creative_temperature
from ..models import Ingredient
from ..schemas import IngredientIn, IngredientUpdate, RecognizeRequest
from ..database import get_db
from ..shelf_life import default_shelf_days

router = APIRouter(prefix="/api/ingredients", tags=["ingredients"])


@router.get("")
def list_ingredients(db: Session = Depends(get_db)):
    rows = db.query(Ingredient).order_by(Ingredient.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "category": r.category,
            "quantity": r.quantity,
            "expires_at": r.expires_at,
        }
        for r in rows
    ]


@router.post("")
def add_ingredients(body: IngredientIn, db: Session = Depends(get_db)):
    existing = {r.name for r in db.query(Ingredient.name).all()}
    added, skipped = [], []

    def _add(name: str, category: str | None, quantity: str | None):
        name = name.strip()
        if not name:
            return
        if name in existing:
            skipped.append(name)
            return
        # 兼容"名称*数量"快速语法（如 生菜*1颗），后端兜底解析
        m = re.match(r"^(.+?)[*×](.+)$", name)
        if m and not quantity:
            name, quantity = m.group(1).strip(), m.group(2).strip()
        if name in existing:
            skipped.append(name)
            return
        # 常见食材自动补默认保质期（用户可随时在编辑弹层修改）
        expires_at = None
        days = default_shelf_days(name)
        if days is not None:
            expires_at = (date.today() + timedelta(days=days)).isoformat()
        db.add(
            Ingredient(
                name=name[:64],
                category=(category or None),
                quantity=(quantity.strip() or None) if quantity else None,
                expires_at=expires_at,
            )
        )
        existing.add(name)
        added.append(name)

    if body.items:
        for item in body.items:
            _add(item.name, item.category or body.category, item.quantity)
    else:
        for name in body.names:
            _add(name, body.category, None)

    db.commit()
    return {"added": added, "skipped": skipped}


@router.patch("/{ingredient_id}")
def update_ingredient(ingredient_id: int, body: IngredientUpdate, db: Session = Depends(get_db)):
    row = db.get(Ingredient, ingredient_id)
    if not row:
        raise HTTPException(404, "食材不存在")
    if body.quantity is not None:
        row.quantity = body.quantity.strip() or None
    if body.expires_at is not None:
        row.expires_at = body.expires_at or None
    if body.category is not None:
        row.category = body.category.strip() or None
    db.commit()
    return {
        "id": row.id,
        "name": row.name,
        "category": row.category,
        "quantity": row.quantity,
        "expires_at": row.expires_at,
    }


@router.delete("/{ingredient_id}")
def delete_ingredient(ingredient_id: int, db: Session = Depends(get_db)):
    row = db.get(Ingredient, ingredient_id)
    if not row:
        raise HTTPException(404, "食材不存在")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/recognize")
def recognize_ingredients(body: RecognizeRequest, db: Session = Depends(get_db)):
    """拍照识别食材：DeepSeek 视觉模型实时分析图片。"""
    if len(body.image_base64) > MAX_IMAGE_B64_LENGTH:
        raise HTTPException(413, "图片过大，请压缩后重试（建议小于 4MB）")
    if not body.image_base64.strip():
        raise HTTPException(400, "图片数据为空")

    known = [r[0] for r in db.query(Ingredient.name).all()]
    user_prompt = prompts.recognize_ingredients_prompt(known)
    try:
        data = chat_vision_json(
            prompts.VISION_SYSTEM,
            user_prompt,
            body.image_base64,
            mime_type=body.mime_type,
        )
    except DeepSeekError as exc:
        raise HTTPException(503, str(exc)) from exc

    items = data.get("ingredients") or []
    results = [
        {"name": str(it.get("name", "")).strip()[:32], "confidence": float(it.get("confidence", 0.8))}
        for it in items
        if str(it.get("name", "")).strip()
    ]
    return {"ingredients": results}


@router.get("/suggestions")
def suggest_ingredients(db: Session = Depends(get_db)):
    """由 DeepSeek 实时生成食材建议，无任何预置数据。"""
    current = [r[0] for r in db.query(Ingredient.name).all()]
    system, user = prompts.ingredient_suggestions_prompt(current)
    try:
        data = chat_json(system, user, temperature=creative_temperature(1.0), max_tokens=2048)
    except DeepSeekError as exc:
        raise HTTPException(503, str(exc)) from exc
    return data


@router.get("/health-check")
def fridge_health_check(db: Session = Depends(get_db)):
    """AI 冰箱体检：营养结构分析 + 评级 + 采购建议。"""
    current = [r[0] for r in db.query(Ingredient.name).all()]
    if not current:
        raise HTTPException(400, "冰箱是空的，先添加一些食材再来体检吧")
    system = prompts.FRIDGE_DOCTOR_SYSTEM
    user = prompts.fridge_health_prompt(current)
    try:
        data = chat_json(system, user, temperature=creative_temperature(0.85), max_tokens=2048)
    except DeepSeekError as exc:
        raise HTTPException(503, str(exc)) from exc

    grade = str(data.get("grade", "B")).strip().upper()[:1]
    if grade not in "ABCD":
        grade = "B"
    return {
        "grade": grade,
        "summary": str(data.get("summary", ""))[:40],
        "highlights": [str(h) for h in (data.get("highlights") or [])][:3],
        "gaps": [str(g) for g in (data.get("gaps") or [])][:3],
        "advice": [str(a) for a in (data.get("advice") or [])][:3],
    }
