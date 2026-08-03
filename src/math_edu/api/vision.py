# -*- coding: utf-8 -*-
"""/api/vision  一张照片 + 一句提示词 → 看着照片说的一句夸奖

孩子和爸妈做完实体纸盒，举到摄像头前拍一张，方方「看见」了就具体地夸一句
（「哇，你用了蓝色的纸！」）。**只夸不判**：识别翻车顶多夸错颜色，
绝不能说孩子做错了 —— 禁令写死在下面的 system 提示词里，前端 `看见.js`
拿回话之后还要再过一遍 `收拾夸奖()`，两道闸门。

  GET  /api/vision   相机按钮该不该出现：没配 key 就 503，前端据此把按钮藏掉
  POST /api/vision   {"image": base64, "mime": "image/jpeg", "prompt": "..."} → {"praise": "..."}

模型走 `VISION_MODEL`（.env 可换）。DashScope 的调用直接写在这里而不是塞进
services/dashscope_client.py：那个文件归语音三件套，这一票不动它。
"""

import base64
import binascii
import re

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from math_edu.settings import API_KEY, VISION_MODEL

router = APIRouter()

# 提示词的第一道闸门。前端还会传一句自己的 prompt（带上「这一讲是什么场景」），
# 这一段是不管哪一讲都不许破的底线，钉在 system 上。
PRAISE_SYS = (
    "你在陪一个5岁的小朋友玩。他把自己动手做的东西举到摄像头前给你看。"
    "你的唯一任务是夸他，而且要夸得具体：说出你在照片里看见的颜色、形状、材料、贴纸。"
    "硬性规则："
    "1) 只夸，绝不评价对错好坏，绝不指出问题；"
    "2) 不许出现「对」「不对」「错」「正确」「可惜」「不过」「但是」「应该」这类词；"
    "3) 不许提问，不许给建议；"
    "4) 只说一句话，不超过20个字；"
    "5) 像小朋友的好朋友那样说话，热情、简单。"
    "只输出这一句话本身，不要引号，不要解释，不要换行。"
)

DEFAULT_PROMPT = "看看我做的这个，夸夸我吧！"

# 看图夸奖的墙钟上限（秒）。整张 base64 图 + 一句夸奖，给 20s；SDK 默认
# request_timeout 是 300s 等于没有 —— DashScope 挂起时后端跟着挂。超时 requests
# 抛异常 → 下面 call_vision 外的 except → 502，前端换一句保底夸奖不冷场。
# 不进 .env —— 安全阀，不是家长要调的模型旋钮。
_VISION_TIMEOUT_SECONDS = 20

# 长边缩到 768 的 jpeg 一般 60KB 上下；给 20 倍余量，再大就是有人在乱塞
MAX_IMAGE_BYTES = 6 * 1024 * 1024

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/bmp"}


class VisionRequest(BaseModel):
    image: str = ""
    mime: str = "image/jpeg"
    prompt: str = ""


def _clean_base64(raw: str) -> str:
    """前端可能直接把整个 dataURL 甩过来，这里一并收下"""
    match = re.match(r"^data:([^;,]+);base64,(.*)$", raw, re.S)
    if match:
        return match.group(2).strip()
    return raw.strip()


def _extract_text(message_content) -> str:
    """omni / vl / 统一模型返回的 content 形状不一，能拿到字就行"""
    if isinstance(message_content, str):
        return message_content
    if isinstance(message_content, list):
        parts = []
        for part in message_content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and part.get("text"):
                parts.append(str(part["text"]))
        return "".join(parts)
    return ""


def call_vision(data_url: str, prompt: str) -> str:
    from dashscope import MultiModalConversation

    messages = [
        {"role": "system", "content": [{"text": PRAISE_SYS}]},
        {"role": "user", "content": [{"image": data_url}, {"text": prompt}]},
    ]
    resp = MultiModalConversation.call(
        model=VISION_MODEL, messages=messages, result_format="message",
        request_timeout=_VISION_TIMEOUT_SECONDS)
    if resp.status_code != 200:
        raise RuntimeError(f"vision {resp.status_code}: {getattr(resp, 'message', '')}")
    text = _extract_text(resp.output.choices[0].message.content)
    return " ".join(text.split()).strip()


@router.get("/api/vision")
def vision_ready():
    """相机按钮的开关：没配 key 就 503，前端一问便知，不摆那个点了没反应的按钮"""
    if not API_KEY:
        return JSONResponse({"ready": False, "error": "no api key"}, status_code=503)
    return {"ready": True, "model": VISION_MODEL}


@router.post("/api/vision")
def vision(req: VisionRequest):
    if not API_KEY:
        return JSONResponse({"error": "no api key"}, status_code=503)

    data = _clean_base64(req.image or "")
    if not data:
        return JSONResponse({"error": "empty image"}, status_code=400)
    if len(data) > MAX_IMAGE_BYTES:
        return JSONResponse({"error": "image too large"}, status_code=413)
    try:
        base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError):
        return JSONResponse({"error": "bad base64"}, status_code=400)

    mime = (req.mime or "image/jpeg").strip().lower()
    if mime not in ALLOWED_MIME:
        mime = "image/jpeg"

    prompt = (req.prompt or "").strip() or DEFAULT_PROMPT
    try:
        praise = call_vision(f"data:{mime};base64,{data}", prompt)
    except Exception as exc:  # 前端会自己换一句保底夸奖，孩子不会冷场
        return JSONResponse({"error": str(exc)}, status_code=502)
    if not praise:
        return JSONResponse({"error": "empty praise"}, status_code=502)
    return {"praise": praise, "model": VISION_MODEL}
