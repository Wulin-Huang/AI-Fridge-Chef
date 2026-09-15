"""SSE 流式接口实测：验证逐块推送与终止标记。"""
import json
import time

import httpx

body = {
    "ingredients": ["鸡蛋", "番茄", "牛腩"],
    "style": "由你自由发挥",
    "servings": 2,
    "preferences": "",
    "excluded": [],
}

chunks = 0
done = False
first_ts = None
full_text = ""
error_msg = None

with httpx.stream(
    "POST", "http://127.0.0.1:8730/api/recipes/generate-stream", json=body, timeout=180
) as r:
    print("HTTP", r.status_code, r.headers.get("content-type"))
    for line in r.iter_lines():
        if not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            done = True
            break
        try:
            payload = json.loads(data)
        except json.JSONDecodeError:
            continue
        if "error" in payload:
            error_msg = payload["error"]
            break
        if "text" in payload:
            if first_ts is None:
                first_ts = time.time()
                print("首块到达（流式生效，非一次性返回）")
            full_text += payload["text"]
            chunks += 1

print("SSE 数据块数:", chunks)
print("终止标记 [DONE]:", done)
print("错误:", error_msg)
print("累计文本长度:", len(full_text))

if full_text:
    data = json.loads(full_text)
    names = [r["name"] for r in data.get("recipes", [])]
    print("最终解析出菜谱:", names)

assert done and chunks > 10 and full_text, "SSE 流式验证失败"
print("\nSSE 流式接口验证通过 ✅")
