from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import prompts
from ..config import MAX_IMAGE_B64_LENGTH
from ..database import get_db
from ..deepseek import DeepSeekError, chat_vision_json
from ..models import CookLog, Favorite, Ingredient
from ..schemas import CheckIn, CritiqueRequest

router = APIRouter(prefix="/api/kitchen", tags=["kitchen"])


# 成就定义：达到门槛即点亮（基于用户真实打卡数据的规则计算，非预置业务数据）
ACHIEVEMENTS = [
    {"key": "first_fire", "emoji": "🔥", "title": "初次开火", "desc": "完成第一道菜", "target": 1},
    {"key": "five_dishes", "emoji": "🍳", "title": "小试牛刀", "desc": "累计做 5 道菜", "target": 5},
    {"key": "ten_dishes", "emoji": "👨‍🍳", "title": "十全十美", "desc": "累计做 10 道菜", "target": 10},
    {"key": "fifty_dishes", "emoji": "🏆", "title": "百炼成厨", "desc": "累计做 50 道菜", "target": 50},
]


def _streak_days(dates: list[date]) -> int:
    """从今天往前数连续有打卡的天数。"""
    days = {d for d in dates}
    streak = 0
    today = date.today()
    if today not in days:
        today -= timedelta(days=1)
        if today not in days:
            return 0
    while today in days:
        streak += 1
        today -= timedelta(days=1)
    return streak


@router.post("/checkin")
def checkin(body: CheckIn, db: Session = Depends(get_db)):
    log = CookLog(
        recipe_name=body.recipe_name.strip(),
        emoji=body.emoji,
        rating=body.rating,
        note=body.note,
    )
    db.add(log)
    db.commit()
    return {"id": log.id, "created_at": log.created_at.isoformat()}


@router.get("/stats")
def kitchen_stats(db: Session = Depends(get_db)):
    logs = db.query(CookLog).order_by(CookLog.created_at.desc()).all()
    fav_count = db.query(Favorite).count()
    ingredient_count = db.query(Ingredient).count()

    dates = [log.created_at.date() for log in logs]
    streak = _streak_days(dates)

    unlocked = []
    locked = []
    for a in ACHIEVEMENTS:
        item = {"key": a["key"], "emoji": a["emoji"], "title": a["title"], "desc": a["desc"]}
        if len(logs) >= a["target"]:
            unlocked.append({**item, "progress": a["target"]})
        else:
            locked.append({**item, "progress": len(logs), "target": a["target"]})

    rating_logs = [l for l in logs if l.rating]
    avg_rating = round(sum(l.rating for l in rating_logs) / len(rating_logs), 1) if rating_logs else None

    return {
        "total_cooked": len(logs),
        "streak_days": streak,
        "avg_rating": avg_rating,
        "favorites": fav_count,
        "ingredients": ingredient_count,
        "achievements": {"unlocked": unlocked, "locked": locked},
        "recent_logs": [
            {
                "id": l.id,
                "recipe_name": l.recipe_name,
                "emoji": l.emoji,
                "rating": l.rating,
                "note": l.note,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs[:20]
        ],
    }


@router.post("/critique")
def critique(body: CritiqueRequest):
    """AI 厨艺点评：视觉模型点评成品照片。"""
    if len(body.image_base64) > MAX_IMAGE_B64_LENGTH:
        raise HTTPException(413, "图片过大，请压缩后重试（建议小于 4MB）")
    if not body.image_base64.strip():
        raise HTTPException(400, "图片数据为空")

    try:
        data = chat_vision_json(
            prompts.CRITIQUE_SYSTEM,
            prompts.critique_prompt(body.recipe_name.strip()[:64]),
            body.image_base64,
            mime_type=body.mime_type,
        )
    except DeepSeekError as exc:
        raise HTTPException(503, str(exc)) from exc

    score = data.get("score")
    if not isinstance(score, int) or not 60 <= score <= 100:
        score = max(60, min(100, int(score) if score else 75))
    return {
        "score": score,
        "verdict": str(data.get("verdict", "这道菜看着不错！")),
        "highlights": [str(h) for h in (data.get("highlights") or [])][:2],
        "improvements": [str(i) for i in (data.get("improvements") or [])][:2],
    }
