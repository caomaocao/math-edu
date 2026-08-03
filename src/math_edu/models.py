# -*- coding: utf-8 -*-
"""账号体系的五张表（SQLAlchemy 2.0，Postgres）。

后端对进度 payload **完全不透明**：progress.payload 就是 localStorage 里那份带版本
JSON 的原样，版本迁移/洗数据/合并全部留在各讲前端。这里只负责存取，不认识星星和图鉴。

本模块两种模式下都会被 import（auth/progress 两个 router 无条件挂载，import 链带进来）——
off 模式的不变量是**不连库、不建表**：engine 惰性初始化，只有 AUTH_MODE=on 的启动路径
才 init_engine()/create_all()（见 db.py）。import ≠ 连接。
"""
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class User(Base):
    """一个手机号一个账号。无密码列（纯短信登录）、无角色列（只有一种使用者）。"""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    phone = Column(Text, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)


class InviteCode(Base):
    """一次性邀请码：准入的唯一大门。用过即废（used_by / used_at 落定）。"""

    __tablename__ = "invite_codes"

    id = Column(Integer, primary_key=True)
    code = Column(Text, nullable=False, unique=True)
    used_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    used_at = Column(DateTime(timezone=True), nullable=True)


class Progress(Base):
    """一个用户 × 一个 localStorage 键 = 一行。payload 整包 jsonb，后端不解读。

    「加一讲零后端改动」在这里兑现：第 4 讲的新进度键进来就是多一行，不建表不改码。
    """

    __tablename__ = "progress"
    __table_args__ = (
        UniqueConstraint("user_id", "storage_key", name="uq_progress_user_key"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    storage_key = Column(Text, nullable=False)
    payload = Column(JSONB, nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class VerifySession(Base):
    """图形验证 → 准发短信 → 计数 的服务端状态。发送计数必须在服务端 —— 塞进签名
    cookie 会被重放绕过防轰炸。过期行由 verify 层访问时惰性清理。"""

    __tablename__ = "verify_sessions"

    id = Column(Integer, primary_key=True)
    sid = Column(Text, nullable=False, unique=True)
    intent = Column(Text, nullable=False)
    captcha_passed_at = Column(DateTime(timezone=True), nullable=True)
    sms_target_phone = Column(Text, nullable=True)
    sms_send_count = Column(Integer, nullable=False, server_default="0")
    expires_at = Column(DateTime(timezone=True), nullable=False)


class SmsSend(Base):
    """每发一条短信一行。per-phone 限频 = 按 (phone, sent_at) 窗口 COUNT；
    顺便是短信支出的审计账。"""

    __tablename__ = "sms_sends"
    __table_args__ = (
        Index("ix_sms_sends_phone_time", "phone", "sent_at"),
    )

    id = Column(Integer, primary_key=True)
    phone = Column(Text, nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
