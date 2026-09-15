"""DeepSeek API 封装。

所有业务内容（食材建议、菜谱、菜单、购物清单）均由模型实时生成，
项目中不存在任何预置菜谱或固定推荐数据。
"""

import json
import logging
import random
import re

from openai import OpenAI

from .config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL,
    DEEPSEEK_VISION_MODEL,
)

logger = logging.getLogger(__name__)

client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

MAX_JSON_RETRIES = 2


class DeepSeekError(RuntimeError):
    pass


def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise DeepSeekError(f"模型未返回合法 JSON: {text[:200]}")


def chat_json(system: str, user: str, temperature: float = 0.9, max_tokens: int = 4096) -> dict:
    """调用 DeepSeek 并解析为 JSON。失败自动重试一次。"""
    last_error: Exception | None = None
    for _ in range(MAX_JSON_RETRIES):
        try:
            completion = client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
            )
            return _extract_json(completion.choices[0].message.content or "")
        except DeepSeekError as exc:
            last_error = exc
            logger.warning("JSON 解析失败，重试: %s", exc)
        except Exception as exc:  # 网络 / 鉴权 / 限流等
            last_error = exc
            logger.error("DeepSeek 调用失败: %s", exc)
            raise DeepSeekError(f"AI 服务暂时不可用，请稍后重试（{exc}）") from exc

    raise DeepSeekError(f"AI 返回内容无法解析，请重试（{last_error}）")


def chat_json_stream(system: str, user: str, temperature: float = 1.0, max_tokens: int = 4096):
    """流式调用 DeepSeek，逐块 yield 文本增量（用于 SSE 打字机效果）。"""
    completion = client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        stream=True,
    )
    for chunk in completion:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content


def chat_vision_json(system: str, user: str, image_b64: str, mime_type: str = "image/jpeg",
                     max_tokens: int = 2048) -> dict:
    """调用 DeepSeek 视觉模型（图片 + 文本 → JSON）。

    视觉模型带思维链（reasoning_content），max_tokens 必须给足，
    否则 token 被思考耗尽后 content 为空。
    """
    last_error: Exception | None = None
    for _ in range(MAX_JSON_RETRIES):
        try:
            completion = client.chat.completions.create(
                model=DEEPSEEK_VISION_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime_type};base64,{image_b64}"},
                            },
                        ],
                    },
                ],
                temperature=0.4,
                max_tokens=max_tokens,
            )
            content = completion.choices[0].message.content or ""
            if not content.strip():
                raise DeepSeekError("视觉模型未返回内容，请重试")
            return _extract_json(content)
        except DeepSeekError as exc:
            last_error = exc
            logger.warning("视觉模型 JSON 解析失败，重试: %s", exc)
        except Exception as exc:
            last_error = exc
            logger.error("DeepSeek 视觉调用失败: %s", exc)
            raise DeepSeekError(f"AI 服务暂时不可用，请稍后重试（{exc}）") from exc

    raise DeepSeekError(f"AI 返回内容无法解析，请重试（{last_error}）")


def creative_temperature(base: float = 0.9) -> float:
    """每次请求加入轻微随机扰动，进一步降低输出同质化。"""
    return round(max(0.5, min(1.3, base + random.uniform(-0.15, 0.15))), 2)
