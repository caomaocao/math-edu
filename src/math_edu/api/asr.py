# -*- coding: utf-8 -*-
"""/api/asr    孩子的 wav → 文字（fun-asr-flash，免费额度内）"""

import os
import tempfile

from fastapi import APIRouter, Form, UploadFile
from fastapi.responses import JSONResponse

from math_edu.settings import API_KEY
from math_edu.services.dashscope_client import call_asr

router = APIRouter()


@router.post("/api/asr")
async def asr(file: UploadFile, context: str = Form("")):
    if not API_KEY:
        return JSONResponse({"error": "no api key"}, status_code=503)
    data = await file.read()
    if len(data) < 1000:
        return {"text": ""}
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(data)
        wav_path = f.name
    try:
        text = call_asr(wav_path, context.strip())
        return {"text": text}
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=502)
    finally:
        os.unlink(wav_path)
