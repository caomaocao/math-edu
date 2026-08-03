# -*- coding: utf-8 -*-
"""/api/tts    文本 → 童声 mp3（磁盘缓存，同一句话只计费一次）"""

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse

from math_edu.settings import API_KEY, TTS_VOICE, TTS_VOICE_EN
from math_edu.services.tts_cache import cache_path, ensure_cached

router = APIRouter()


def default_voice(lang: str) -> str:
    """这种语言默认用哪把嗓子。

    英文没单独配就回落到中文那把 —— 默认的龙杰力豆本来就中英双语，
    一把童嗓说两种语言，孩子听见的是同一个「方方」。
    """
    if lang.strip().lower() == "en":
        return TTS_VOICE_EN or TTS_VOICE
    return TTS_VOICE


@router.get("/api/tts")
def tts(text: str, voice: str = "", lang: str = ""):
    text = text.strip()
    if not text:
        return JSONResponse({"error": "empty text"}, status_code=400)
    # 显式 voice 永远说了算（试音页就靠它一把一把地试听），没给才按语言挑
    v = voice.strip() or default_voice(lang)
    path = cache_path(text, v)
    if not path.exists():
        if not API_KEY:
            return JSONResponse({"error": "no api key"}, status_code=503)
        try:
            path = ensure_cached(text, v)
        except Exception as exc:  # 让前端能降级到 Web Speech
            return JSONResponse({"error": str(exc)}, status_code=502)
    return FileResponse(path, media_type="audio/mpeg",
                        headers={"Cache-Control": "max-age=31536000"})
