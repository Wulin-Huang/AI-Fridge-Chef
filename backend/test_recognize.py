"""拍照识别接口全链路实测：直连后端 + 经 Vite 代理两条链路。"""
import base64
import json
import sys
import time

import httpx

sys.path.insert(0, ".")

with open("test_food_photo.jpg", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

body = {"image_base64": img_b64, "mime_type": "image/jpeg"}

expected = {"西红柿", "番茄", "鸡蛋", "牛肉", "牛排", "葱", "小葱", "青葱", "西兰花"}

for url in ["http://127.0.0.1:8730/api/ingredients/recognize"]:
    print("===", url, "===")
    t0 = time.time()
    resp = httpx.post(url, json=body, timeout=120)
    elapsed = time.time() - t0
    print("HTTP", resp.status_code, f"耗时 {elapsed:.1f}s")
    text = resp.text
    print("原始响应(前300):", text[:300])

    if resp.status_code == 200:
        # PowerShell 输出编码不可靠，用 bytes 重新解码
        raw = resp.content.decode("utf-8", errors="replace")
        data = json.loads(raw)
        names = [i["name"] for i in data["ingredients"]]
        print("识别结果:", names)
        hits = [n for n in names if n in expected]
        print(f"命中期望食材: {len(hits)}/{len(names)}")
        assert len(hits) >= 4, "识别结果与测试图不符"
        print("拍照识别接口验证通过 ✅\n")
