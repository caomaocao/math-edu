# -*- coding: utf-8 -*-
"""验证会话状态机 + per-phone 限频 —— 语义照搬 wechat_screen_detect/web/sms_session.py，
存储从 Redis 换成 Postgres（01 建好的 VerifySession / SmsSend 两张表）。

与参考实现的差异（都是 spec 拍板的收敛）：
  - intent 只有一种（登录注册合一），参考项目 register/login/reset_password/... 五态不搬。
  - 会话状态不再塞进 TTL key，而是 verify_sessions 一行；expires_at 到点由访问方惰性清理。
  - 发送计数（sms_send_count）在服务端行上，塞签名 cookie 会被重放绕过防轰炸。
  - 限频不再是 Redis incr+expire，而是对 sms_sends 流水按时间窗 COUNT —— 顺便是短信支出审计账，
    且**重启不丢**（计数活在 Postgres，不在进程内存）。

本模块的函数都接收一个 SQLAlchemy Session；开/关/提交由调用方（端点）掌管。
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func

from math_edu.models import SmsSend, VerifySession

# 登录注册合一：intent 只有这一种。
INTENT = "auth"

# 验证会话 TTL：30 分钟（图形验证 → 短信 → 提交 的整段窗口）。
SESSION_TTL = timedelta(minutes=30)
SESSION_TTL_SECONDS = int(SESSION_TTL.total_seconds())

# 单次图形验证码最多放行的短信条数。挡「过一次验证码 → 轮换手机号反复发」的短信轰炸/盗刷；
# 5 条给正常流程（1 条 + 合理重发）留足余量。超出须重新过图形验证（captcha_passed 清零）。
MAX_SENDS_PER_CAPTCHA = 5

# per-phone 限频（硬编码，spec 不进 config）。
RATE_LIMIT_PER_MINUTE = 1
RATE_LIMIT_PER_HOUR = 5
RATE_LIMIT_PER_DAY = 10


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    """DB 读回的 timestamptz 已带时区；给可能的 naive 值兜个 UTC，比较不炸。"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def is_expired(sess: VerifySession) -> bool:
    exp = _aware(sess.expires_at)
    return exp is None or exp < now_utc()


def load_session(db, sid: str | None, intent: str = INTENT) -> VerifySession | None:
    """按 sid 读会话。过期行惰性清理（删掉返回 None）；intent 不匹配也返回 None。

    删除只 flush 不 commit —— 由调用方在其自身事务收尾时一并提交。
    """
    if not sid:
        return None
    sess = db.query(VerifySession).filter_by(sid=sid).one_or_none()
    if sess is None:
        return None
    if is_expired(sess):
        db.delete(sess)
        db.flush()
        return None
    if sess.intent != intent:
        return None
    return sess


def create_session(db, intent: str = INTENT) -> VerifySession:
    """新建一行验证会话（新 sid + 30 分钟 TTL）。已 add+flush，sid 可读；由调用方提交。"""
    sess = VerifySession(
        sid=secrets.token_urlsafe(24),
        intent=intent,
        sms_send_count=0,
        expires_at=now_utc() + SESSION_TTL,
    )
    db.add(sess)
    db.flush()
    return sess


def get_or_create(db, sid: str | None, intent: str = INTENT) -> VerifySession:
    """读现有会话，没有（或已过期/不匹配）则新建。"""
    sess = load_session(db, sid, intent)
    if sess is not None:
        return sess
    return create_session(db, intent)


def destroy(db, sid: str) -> None:
    """销毁一行验证会话（登录/注册成功后）。由调用方提交。"""
    sess = db.query(VerifySession).filter_by(sid=sid).one_or_none()
    if sess is not None:
        db.delete(sess)
        db.flush()


def check_sms_rate(db, phone: str) -> None:
    """三窗口叠加限频：1/分、5/时、10/天。超额抛 429。

    计当前这一条之前、窗口内已有的流水条数：cnt >= limit 即拒（等价参考项目 incr 后 v>limit）。
    发送成功后再由端点 record_sms_send() 落一行，所以这里 COUNT 不含当前尝试。
    """
    now = now_utc()
    windows = (
        (timedelta(minutes=1), RATE_LIMIT_PER_MINUTE, 60),
        (timedelta(hours=1), RATE_LIMIT_PER_HOUR, 3600),
        (timedelta(days=1), RATE_LIMIT_PER_DAY, 86400),
    )
    for delta, limit, retry_after in windows:
        cnt = (
            db.query(func.count(SmsSend.id))
            .filter(SmsSend.phone == phone, SmsSend.sent_at >= now - delta)
            .scalar()
        ) or 0
        if cnt >= limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "sms_rate_limit_exceeded",
                    "message": "短信发送过于频繁",
                    "retry_after_seconds": retry_after,
                },
            )


def record_sms_send(db, phone: str) -> None:
    """发送成功后落一条流水（限频计数 + 短信支出审计）。由调用方提交。"""
    db.add(SmsSend(phone=phone, sent_at=now_utc()))
    db.flush()
