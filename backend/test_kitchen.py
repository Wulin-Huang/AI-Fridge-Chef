"""厨房功能测试用例：打卡 / 统计 / 成就 / 连续天数计算。

只测本地逻辑接口（不消耗 AI 调用），使用隔离的内存数据库。
"""
import sys
from datetime import datetime, timedelta

sys.path.insert(0, ".")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.routers.kitchen import _streak_days
from app.models import CookLog

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app.dependency_overrides[get_db] = lambda: TestingSessionLocal()
client = TestClient(app)

passed = []
failed = []


def check(name, cond):
    (passed if cond else failed).append(name)
    print(("PASS" if cond else "FAIL"), "-", name)


# --- 1. 空状态统计 ---
r = client.get("/api/kitchen/stats")
check("空状态统计 200", r.status_code == 200)
s = r.json()
check("初始做过 0 道", s["total_cooked"] == 0)
check("初始无成就点亮", len(s["achievements"]["unlocked"]) == 0)
check("初始锁定成就 4 枚", len(s["achievements"]["locked"]) == 4)

# --- 2. 打卡 ---
r = client.post("/api/kitchen/checkin", json={"recipe_name": "番茄炒蛋", "emoji": "🍅", "rating": 5, "note": "很成功"})
check("打卡 200", r.status_code == 200)
check("打卡返回 id", r.json()["id"] > 0)

r = client.post("/api/kitchen/checkin", json={"recipe_name": "", "rating": 5})
check("空菜名被校验拒绝", r.status_code == 422)

r = client.post("/api/kitchen/checkin", json={"recipe_name": "红烧肉", "rating": 99})
check("评分超界被拒绝", r.status_code == 422)

# --- 3. 统计与成就 ---
r = client.get("/api/kitchen/stats")
s = r.json()
check("做过 1 道", s["total_cooked"] == 1)
check("初次开火点亮", any(a["key"] == "first_fire" for a in s["achievements"]["unlocked"]))
check("打卡记录含菜名", s["recent_logs"][0]["recipe_name"] == "番茄炒蛋")
check("平均评分 5.0", s["avg_rating"] == 5.0)

# 连续打 4 天 → 小试牛刀(5道)未解锁，进度 5/5 达标
db = TestingSessionLocal()
now = datetime.now()
for i in range(4):
    db.add(CookLog(recipe_name=f"测试菜{i}", created_at=now - timedelta(days=i)))
db.commit()
db.close()

r = client.get("/api/kitchen/stats")
s = r.json()
check("做过 5 道", s["total_cooked"] == 5)
check("小试牛刀点亮", any(a["key"] == "five_dishes" for a in s["achievements"]["unlocked"]))
check("连续打卡 4 天", s["streak_days"] == 4)

# --- 4. 连续天数计算纯函数 ---
today = datetime.now().date()
check("只有昨天打卡 → streak 1", _streak_days([today - timedelta(days=1)]) == 1)
check("前天打卡无今天昨天 → 0", _streak_days([today - timedelta(days=2)]) == 0)
check("连续三天含今天 → 3", _streak_days([today, today - timedelta(1), today - timedelta(2)]) == 3)
check("断档连续不算", _streak_days([today, today - timedelta(2)]) == 1)

# --- 5. 打卡记录分页上限（前 20 条）---
db = TestingSessionLocal()
db.query(CookLog).delete()
for i in range(25):
    db.add(CookLog(recipe_name=f"批量菜{i}", created_at=now - timedelta(hours=i)))
db.commit()
db.close()
r = client.get("/api/kitchen/stats")
check("recent_logs 最多 20 条", len(r.json()["recent_logs"]) == 20)

print()
if failed:
    print(f"{len(failed)} 个用例失败 ❌")
    sys.exit(1)
print(f"厨房功能全部 {len(passed)} 个用例通过 ✅")
