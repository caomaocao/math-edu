# -*- coding: utf-8 -*-
"""用户 / 邀请码查询与建号辅助 —— 端点逻辑的纯数据层。

准入的唯一大门是一次性邀请码：新手机号必须携带一枚有效未用邀请码才建号。
老手机号（users 里已有）直接登录，不需要邀请码。
"""
from __future__ import annotations

import re

from math_edu.models import InviteCode, User
from math_edu.verify_state import now_utc

# 中国大陆手机号：1[3-9] 开头共 11 位。
_PHONE_RE = re.compile(r"^1[3-9]\d{9}$")


def valid_phone(phone: str | None) -> bool:
    return bool(phone and _PHONE_RE.match(phone))


def find_user_by_phone(db, phone: str) -> User | None:
    return db.query(User).filter_by(phone=phone).one_or_none()


def find_valid_invite(db, code: str | None) -> InviteCode | None:
    """有效未用邀请码；瞎编 / 已用 都返回 None。"""
    if not code:
        return None
    invite = db.query(InviteCode).filter_by(code=code).one_or_none()
    if invite is None or invite.used_by is not None:
        return None
    return invite


def is_eligible(db, phone: str, invite_code: str | None) -> bool:
    """发码前的资格：老用户，或携带有效未用邀请码。都不是则陌生人 —— 短信不发。"""
    if find_user_by_phone(db, phone) is not None:
        return True
    return find_valid_invite(db, invite_code) is not None


def register_user(db, phone: str, invite: InviteCode) -> User:
    """建号 + 标记邀请码已用（used_by / used_at）。由调用方提交。"""
    now = now_utc()
    user = User(phone=phone, created_at=now, last_login_at=now)
    db.add(user)
    db.flush()  # 拿到 user.id
    invite.used_by = user.id
    invite.used_at = now
    db.flush()
    return user
