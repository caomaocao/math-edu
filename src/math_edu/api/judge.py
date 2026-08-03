# -*- coding: utf-8 -*-
"""/api/judge  规则判不了时的兜底：原始音频+题目 → 全模态模型裁决"""

import json
import os
import tempfile

from fastapi import APIRouter, Form, UploadFile
from fastapi.responses import JSONResponse

from math_edu.settings import API_KEY
from math_edu.services.dashscope_client import call_judge

router = APIRouter()


@router.post("/api/judge")
async def judge(file: UploadFile, question: str = Form(...), accept: str = Form(...)):
    if not API_KEY:
        return JSONResponse({"error": "no api key"}, status_code=503)
    data = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(data)
        wav_path = f.name
    try:
        result = call_judge(wav_path, question, json.loads(accept))
        return result
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=502)
    finally:
        os.unlink(wav_path)
