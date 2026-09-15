"""写入演示数据：丰富界面展示用（食材含保质期、打卡记录）。

用法：python seed.py            # 幂等写入演示数据
      python seed.py --reset    # 清空后重新写入
"""
import sys
from datetime import datetime, timedelta

sys.path.insert(0, ".")

from app.database import SessionLocal, engine
from app.models import Base, CookLog, Ingredient

DEMO_INGREDIENTS = [
    # (名称, 数量, 过期日偏移天数，None=不填)
    ("鸡蛋", "6 个", 4),
    ("西红柿", "3 个", 2),
    ("牛腩", "500g", 1),
    ("西兰花", "1 颗", 3),
    ("小葱", "1 把", 5),
    ("土豆", "4 个", 12),
    ("胡萝卜", "2 根", 9),
    ("五花肉", "400g", 2),
    ("豆腐", "1 盒", 2),
    ("香菇", "8 朵", 6),
    ("大蒜", "1 头", 20),
    ("青椒", "2 个", 5),
]

DEMO_LOGS = [
    # (菜名, emoji, 评分, 心得, 天数偏移)
    ("番茄炒蛋", "🍅", 5, "酸甜开胃，比上次更嫩了", 1),
    ("蒜蓉西兰花", "🥦", 4, "焯水 30 秒刚好脆嫩", 2),
    ("红烧牛腩", "🍲", 5, "小火慢炖两小时，入口即化", 4),
    ("香菇青菜", "🍄", 4, "香菇提前泡发更香", 6),
    ("土豆炖五花肉", "🥘", 5, "下饭神器，连吃两碗", 7),
]


def main(reset: bool = False):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if reset:
            db.query(Ingredient).delete()
            db.query(CookLog).delete()
            db.commit()
            print("已清空 ingredients / cook_logs")

        now = datetime.now()
        today = now.date()

        added = 0
        existing = {r[0] for r in db.query(Ingredient.name).all()}
        for name, qty, offset in DEMO_INGREDIENTS:
            if name in existing:
                continue
            expires = (today + timedelta(days=offset)).isoformat()
            db.add(Ingredient(name=name, quantity=qty, expires_at=expires))
            added += 1

        log_count = 0
        existing_logs = db.query(CookLog).count()
        if existing_logs == 0:
            for dish, emoji, rating, note, offset in DEMO_LOGS:
                db.add(
                    CookLog(
                        recipe_name=dish,
                        emoji=emoji,
                        rating=rating,
                        note=note,
                        created_at=now - timedelta(days=offset),
                    )
                )
                log_count += 1

        db.commit()
        print(f"演示数据写入完成：新增食材 {added} 项，新增打卡 {log_count} 条")
        print(f"当前食材总数: {db.query(Ingredient).count()}，打卡总数: {db.query(CookLog).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    main(reset="--reset" in sys.argv)
