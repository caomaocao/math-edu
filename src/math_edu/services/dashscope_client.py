# -*- coding: utf-8 -*-
"""百炼（dashscope）语音接口封装：ASR 转写 + 全模态兜底裁决。"""

import json
import re
import time

from math_edu.settings import ASR_MODEL, JUDGE_MODEL

# DashScope 调用的超时（秒）。SDK 默认 request_timeout 是 300s，等于没有：
# DashScope 慢或挂起时后端跟着一起挂，前端那条 fetch 也就永久 pending。给每类
# 调用一个显式墙钟，超时 requests 抛异常（TimeoutError/ReadTimeout）→ 各 router
# 的 except → 502，正是前端已经接住的「干脆失败」形状。各接口量级不同，分别定。
# 不进 .env —— 这是安全阀，不是家长要调的模型旋钮。
#
# ASR：本地音频要先传上去再转写，给足 20s。
_ASR_TIMEOUT_SECONDS = 20
# judge 是流式全模态，最容易长挂，两道闸一起上：
#   read 闸：相邻两段增量之间最长静默（requests 的 read 超时）。连一段都不来就
#            15s 抛 —— 这一道挡住「连上却一直不吐」。
#   墙钟闸：requests 的 timeout 对流式只管「两次读之间的间隔」，管不住总时长，
#           所以在消费循环里自己再掐一道总时长上限，模型慢慢吐也不许超过它。
# 两道都抛异常 → api/judge.py 的 except → 502。
_JUDGE_READ_TIMEOUT_SECONDS = 15
_JUDGE_TOTAL_TIMEOUT_SECONDS = 25

JUDGE_SYS = (
    "你是幼儿数学老师的判卷助手。你会听到一个5岁孩子对题目的语音回答。"
    "这套课有中文和英文两个版本，孩子可能说中文，也可能说英文，"
    "还可能中英文混着说——三种情况都正常，都要照样判。"
    "孩子吐字可能不清、可能带口头语"
    "（中文的「嗯、那个、我觉得」，英文的 um、uh、like、I think、maybe），"
    "这些都不影响判定。"
    "标准答案用中文写，但**判的是意思，不是语言**：孩子用英文说出同一个意思一样算对，"
    "例如 东=east、北=north、东北=northeast、上面=up/on top/above、下面=down/below、"
    "左边=left、右边=right、前面=in front、后面=behind、"
    "第3行第2列=row three column two（数字词 one…ten 与序数词 first…tenth 都算）。"
    "只要孩子表达的意思和任一标准答案一致就算对，绝不因为他换了一种语言就判错。"
    '只输出 JSON：{"heard":"你听到的话，孩子说哪种语言就用哪种语言写","correct":true或false}'
)


def call_asr(wav_path: str, context: str) -> str:
    from dashscope import MultiModalConversation

    messages = []
    if context:
        # fun-asr 支持上下文热词：把本题候选答案喂进去，含糊童声也能对上。
        # 语种不用显式指定：fun-asr-flash 自己分辨中英（30 语种自动识别），
        # 双语这一关靠上层把两语候选都塞进 context（见 判对.js 的 热词()）。
        messages.append({"role": "system", "content": [{"text": context}]})
    messages.append({"role": "user", "content": [{"audio": f"file://{wav_path}"}]})
    # 前端拼的就是 16kHz 单声道 WAV，这两个参数是 fun-asr 的必填项
    resp = MultiModalConversation.call(model=ASR_MODEL, messages=messages,
                                       result_format="message",
                                       format="wav", sample_rate=16000,
                                       request_timeout=_ASR_TIMEOUT_SECONDS)
    if resp.status_code != 200:
        raise RuntimeError(f"ASR {resp.status_code}: {getattr(resp, 'message', '')}")
    # fun-asr 直接给 output.text（不是 chat 的 choices 结构）
    text = resp.output.get("text") if resp.output else None
    return (text or "").strip()


def call_judge(wav_path: str, question: str, accept: list[str]) -> dict:
    from dashscope import MultiModalConversation

    prompt = f"题目（已读给孩子听）：{question}\n标准答案（任一即可）：{'、'.join(accept)}"
    messages = [
        {"role": "system", "content": [{"text": JUDGE_SYS}]},
        {"role": "user", "content": [{"audio": f"file://{wav_path}"},
                                     {"text": prompt}]},
    ]
    # omni 系列要求流式输出，拼接增量结果
    full = ""
    responses = MultiModalConversation.call(
        model=JUDGE_MODEL, messages=messages, result_format="message",
        stream=True, incremental_output=True,
        request_timeout=_JUDGE_READ_TIMEOUT_SECONDS)
    deadline = time.monotonic() + _JUDGE_TOTAL_TIMEOUT_SECONDS
    try:
        for chunk in responses:
            if time.monotonic() > deadline:  # 慢慢吐也不许超过总时长
                raise TimeoutError(
                    f"judge 裁决超过 {_JUDGE_TOTAL_TIMEOUT_SECONDS}s 未完成")
            if chunk.status_code != 200:
                raise RuntimeError(f"judge {chunk.status_code}: {getattr(chunk, 'message', '')}")
            content = chunk.output.choices[0].message.content
            if isinstance(content, str):
                full += content
            else:
                for part in content:
                    if isinstance(part, dict) and "text" in part:
                        full += part["text"]
    finally:
        # 超时/异常中途退出时，把底层流式连接关掉，别把 socket 挂在那
        close = getattr(responses, "close", None)
        if close is not None:
            close()
    match = re.search(r"\{.*\}", full, re.S)
    if not match:
        raise RuntimeError(f"judge 输出不含 JSON: {full[:200]}")
    out = json.loads(match.group(0))
    return {"heard": str(out.get("heard", "")), "correct": bool(out.get("correct"))}
