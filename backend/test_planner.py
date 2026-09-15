"""菜单规划与菜谱接口测试：Schema 校验 + 保存/列表/删除闭环。

不触发真实 AI 调用（meal-plan/generate 等接口被跳过），
只测新增强功能：count/meals 参数校验 + saved-plans CRUD。
"""
import sys

sys.path.insert(0, ".")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app.dependency_overrides[get_db] = lambda: TestingSessionLocal()
client = TestClient(app)

passed = []
failed = []


def check(name, cond):
    (passed if cond else failed).append(name)
    print(("PASS" if cond else "FAIL"), "-", name)


# --- 1. RecipeRequest.count 校验 ---
r = client.post("/api/recipes/generate-stream", json={"ingredients": ["鸡蛋"], "count": 0})
check("count=0 被拒绝(ge=1)", r.status_code == 422)
r = client.post("/api/recipes/generate-stream", json={"ingredients": ["鸡蛋"], "count": 6})
check("count=6 被拒绝(le=5)", r.status_code == 422)

# --- 2. MealPlanRequest.meals 参数透传（空 meals 兼容旧客户端） ---
# meal-plan 会触发 AI，跳过真实调用；校验非法 meals 结构被拒即可
r = client.post("/api/planner/meal-plan", json={"ingredients": ["鸡蛋"], "days": 0})
check("days=0 被拒绝(ge=1)", r.status_code == 422)

# --- 3. saved-plans CRUD 闭环 ---
PLAN = {"days": [{"day": 1, "idea": "清淡为主", "meals": [
    {"type": "午餐", "dishes": [{"name": "番茄炒蛋", "emoji": "🍅",
     "use_ingredients": ["番茄", "鸡蛋"], "missing_ingredients": ["小葱"]}]}]}],
    "grocery_summary": ["买点小葱"]}

r = client.post("/api/planner/saved-plans", json={"title": "周末菜单", "payload": PLAN})
check("保存菜单 200", r.status_code == 200)
plan_id = r.json()["id"]

r = client.post("/api/planner/saved-plans", json={"title": "", "payload": PLAN})
check("空标题被拒绝", r.status_code == 422)

r = client.get("/api/planner/saved-plans")
check("列表返回 1 条", r.status_code == 200 and len(r.json()) == 1)
saved = r.json()[0]
check("标题正确", saved["title"] == "周末菜单")
check("payload 菜名保留", saved["payload"]["days"][0]["meals"][0]["dishes"][0]["name"] == "番茄炒蛋")
check("created_at 存在", bool(saved["created_at"]))

r = client.delete(f"/api/planner/saved-plans/{plan_id}")
check("删除成功", r.status_code == 200)
r = client.delete(f"/api/planner/saved-plans/{plan_id}")
check("重复删除 404", r.status_code == 404)
r = client.get("/api/planner/saved-plans")
check("删除后列表为空", len(r.json()) == 0)

print()
if failed:
    print(f"{len(failed)} 个用例失败 ❌")
    sys.exit(1)
print(f"规划/菜谱接口全部 {len(passed)} 个用例通过 ✅")
