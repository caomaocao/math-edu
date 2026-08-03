# -*- coding: utf-8 -*-
"""TTS 磁盘缓存：同一句话（同模型同音色）只合成一次。"""

import hashlib
import threading
from pathlib import Path

from math_edu.settings import CACHE_DIR, TTS_MODEL

# 一次只合成一句。
#
# /api/tts 是同步 def，FastAPI 把它扔进线程池，所以几个请求会真的并行跑进来
# （浏览器对同一个域名开六条连接，台词表预热一开就是六条同时打）。
# dashscope 的 SpeechSynthesizer 底下是一条 WebSocket，SDK 里那份连接状态不是
# 每个实例独立的 —— 并发调用时后来的会把先来的连接踩掉，报
# "WebSocket connection is not established or has been closed"，接口回 502。
#
# 实测：六条并发里三条 502。而 502 对孩子是真事故 —— 说话.js 一见错就
# 「降级中」，接下来整整一分钟方方都用系统那个机器嗓子说话。
# 排队慢一点没关系（合成一句约一秒，而且只有第一次；之后都从磁盘缓存直接读）。
_synth_lock = threading.Lock()

# 合成的墙钟上限（毫秒）。SpeechSynthesizer.call 不传 timeout 就无限等
# complete_event —— DashScope 那头一挂起（连上了却不吐完），这句就永远合不完。
# 而它是在 _synth_lock 里跑的：一句卡死，后面每一个现合成请求都跟着在锁上排队
# 等到天荒地老，一次卡死连坐后续所有 TTS。给它一个上限，10s 内必然抛
# TimeoutError 把锁让出来，一次卡死最多废掉这一句，后续请求照常。
# 正常合成一句约 1s，连接阶段 SDK 自带 5s 超时，这里管的是「连上了却不吐完」。
# 不进 .env —— 这是安全阀，不是家长要调的模型旋钮。
_SYNTH_TIMEOUT_MS = 10_000


def cache_path(text: str, voice: str) -> Path:
    key = hashlib.sha1(f"{TTS_MODEL}|{voice}|{text}".encode()).hexdigest()
    return CACHE_DIR / f"{key}.mp3"


def ensure_cached(text: str, voice: str) -> Path:
    """返回这句话的 mp3 路径，没有就合成一份写下来。

    检查—合成—落盘整个包在锁里，而且拿到锁以后**再查一遍缓存**：
    预热和孩子点开页面撞在一起时，同一句话会有两个请求同时发现"缓存里没有"，
    然后排队等锁。没有这第二次检查的话，后来的那个会照样再合成一遍 ——
    多花一次钱、多等一秒，换来一份一模一样的 mp3。
    """
    path = cache_path(text, voice)
    if path.exists():
        return path

    with _synth_lock:
        if path.exists():  # 排队的时候前面那位已经合好了
            return path
        data = _synthesize(text, voice)
        # 先写临时文件再改名：换名字是原子的，别让另一个请求读到写了一半的 mp3
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(data)
        tmp.rename(path)
    return path


def _synthesize(text: str, voice: str) -> bytes:
    from dashscope.audio.tts_v2 import SpeechSynthesizer

    synthesizer = SpeechSynthesizer(model=TTS_MODEL, voice=voice)
    # timeout_millis：合成必在有限时间内结束（成功或 TimeoutError），锁必然让出。
    # TimeoutError 是 Exception，向上传到 api/tts.py 的 except → 502，前端降级到
    # Web Speech —— 正是它已经接住的失败形状。
    audio = synthesizer.call(text, timeout_millis=_SYNTH_TIMEOUT_MS)
    if not isinstance(audio, (bytes, bytearray)) or len(audio) < 200:
        raise RuntimeError(f"TTS 返回异常: {type(audio)} {audio!r:.200}")
    return bytes(audio)
