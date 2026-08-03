# -*- coding: utf-8 -*-
from fastapi import APIRouter

from math_edu.settings import (
    API_KEY,
    ASR_MODEL,
    JUDGE_MODEL,
    TTS_MODEL,
    TTS_VOICE,
    VISION_MODEL,
)

router = APIRouter()


@router.get("/api/health")
def health():
    return {"ok": True, "key_set": bool(API_KEY), "tts": TTS_MODEL,
            "voice": TTS_VOICE, "asr": ASR_MODEL, "judge": JUDGE_MODEL,
            "vision": VISION_MODEL}
