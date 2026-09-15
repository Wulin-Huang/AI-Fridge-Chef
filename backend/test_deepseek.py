"""快速验证 DeepSeek API 连通性。"""
import sys
sys.path.insert(0, '.')

from app.deepseek import chat_json

try:
    data = chat_json(
        "你是测试助手。输出必须是合法 JSON。",
        '请输出 {"ok": true, "message": "你好"}',
        temperature=0.1,
        max_tokens=100,
    )
    print("DeepSeek 连通性 OK:", data)
except Exception as exc:
    print("DeepSeek 调用失败:", exc)
    sys.exit(1)
