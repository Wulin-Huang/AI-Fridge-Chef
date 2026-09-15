"""冰箱小功能测试：默认保质期映射 + 添加自动填充 + 体检空校验（不触发 AI）。"""
import sys
from datetime import date, timedelta

sys.path.insert(0, ".")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.shelf_life import default_shelf_days

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


# --- 1. 保质期映射：精确匹配 ---
check("鸡蛋 → 30 天", default_shelf_days("鸡蛋") == 30)
check("牛腩 → 2 天", default_shelf_days("牛腩") == 2)
check("大米 → 365 天", default_shelf_days("大米") == 365)
check("土豆 → 30 天", default_shelf_days("土豆") == 30)

# --- 2. 模糊关键词匹配 ---
check("内蒙古土豆 → 30 天（关键词）", default_shelf_days("内蒙古土豆") == 30)
check("有机鸡蛋 → 25 天（关键词）", default_shelf_days("有机鸡蛋") == 25)
check("新鲜鲈鱼 → 1 天（关键词）", default_shelf_days("新鲜鲈鱼") == 1)
check("未知神秘食材 → None", default_shelf_days("神秘外星食材xyz") is None)

# --- 3. 添加食材自动填保质期 ---
r = client.post("/api/ingredients", json={"names": ["三文鱼", "进口车厘子"]})
check("添加 200", r.status_code == 200)
rows = {i["name"]: i for i in client.get("/api/ingredients").json()}
check("三文鱼自动填保质期", bool(rows["三文鱼"]["expires_at"]))
if rows["三文鱼"]["expires_at"]:
    got = date.fromisoformat(rows["三文鱼"]["expires_at"])
    expect = date.today() + timedelta(days=2)
    check(f"三文鱼保质期=今天+2天", got == expect)
check("车厘子自动填保质期（关键词'子'不入表但'车厘子'应精确/兜底）", bool(rows["进口车厘子"]["expires_at"]))

r = client.post("/api/ingredients", json={"names": ["量子晶体"]})
rows = {i["name"]: i for i in client.get("/api/ingredients").json()}
check("未知食材不填保质期", rows["量子晶体"]["expires_at"] is None)

# --- 4. 体检空校验（不消耗 AI） ---
from app.database import SessionLocal  # noqa: F401  (仅确认导入无碍)

db = TestingSessionLocal()
from app.models import Ingredient

db.query(Ingredient).delete()
db.commit()
db.close()

r = client.get("/api/ingredients/health-check")
check("空冰箱体检返回 400", r.status_code == 400)
check("错误信息友好", "先添加" in r.json()["detail"])

# --- 5. 自定义分类与数量（items 逐项） ---
r = client.post(
    "/api/ingredients",
    json={"items": [
        {"name": "和牛切片", "category": "火锅食材", "quantity": "2 盒"},
        {"name": "鱼豆腐", "category": "火锅食材"},
        {"name": "生菜*1颗"},
    ]},
)
check("items 添加 200", r.status_code == 200)
rows = {i["name"]: i for i in client.get("/api/ingredients").json()}
check("和牛切片自定义分类", rows["和牛切片"]["category"] == "火锅食材")
check("和牛切片数量", rows["和牛切片"]["quantity"] == "2 盒")
check("鱼豆腐自定义分类", rows["鱼豆腐"]["category"] == "火锅食材")
check("鱼豆腐无数量的 None", rows["鱼豆腐"]["quantity"] is None)
check("生菜带数量", rows["生菜"]["quantity"] == "1颗")

# --- 6. 旧 names 格式兼容 + 全局 category ---
r = client.post("/api/ingredients", json={"names": ["冷冻虾仁"], "category": "水产"})
rows = {i["name"]: i for i in client.get("/api/ingredients").json()}
check("names 旧格式兼容", "冷冻虾仁" in rows)
check("全局 category 生效", rows["冷冻虾仁"]["category"] == "水产")

# --- 7. 空 items 校验 ---
r = client.post("/api/ingredients", json={})
check("names/items 都空被拒绝", r.status_code == 422)

# --- 8. PATCH 修改分类/数量，返回完整对象 ---
target = rows["冷冻虾仁"]
r = client.patch(f"/api/ingredients/{target['id']}", json={"category": "火锅食材", "quantity": "500g"})
check("PATCH 200", r.status_code == 200)
body = r.json()
check("PATCH 返回完整对象（含 name）", body.get("name") == "冷冻虾仁")
check("PATCH 分类已改", body["category"] == "火锅食材")
check("PATCH 数量已改", body["quantity"] == "500g")
check("PATCH 保留原保质期", bool(body["expires_at"]))

r = client.patch("/api/ingredients/99999", json={"category": "x"})
check("PATCH 不存在 404", r.status_code == 404)

print()
if failed:
    print(f"{len(failed)} 个用例失败 ❌")
    sys.exit(1)
print(f"冰箱小功能全部 {len(passed)} 个用例通过 ✅")
