# -*- coding: utf-8 -*-
"""Postgres 连接（SQLAlchemy）。惰性初始化 —— off 模式零依赖、零连接、零建表。

engine 只在 AUTH_MODE=on 时由 create_app() 调 init_engine() 建起。任何在 off 模式下
误调 get_session() 的路径都会拿到清楚的 RuntimeError，而不是一个连了不该连的库的进程。
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from math_edu.settings import DATABASE_URL

_engine = None
_Factory: sessionmaker | None = None


def init_engine() -> None:
    """建全局 engine 与 session 工厂。重复调用无害（已建则跳过）。"""
    global _engine, _Factory
    if _engine is not None:
        return
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL 未配置，无法初始化数据库")
    _engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,   # 断连自愈：取连接前 ping 一下，公网库偶发断连不炸请求
        pool_recycle=1800,
        connect_args={"connect_timeout": 10},
    )
    _Factory = sessionmaker(bind=_engine)


def get_session() -> Session:
    """一个新 Session。off 模式下（未 init）抛错，不静默连库。"""
    if _Factory is None:
        raise RuntimeError("数据库未初始化：只有 AUTH_MODE=on 时才会 init_engine()")
    return _Factory()


def get_engine():
    return _engine


def create_all() -> None:
    """建齐五张表（CREATE TABLE IF NOT EXISTS 等价）。on 模式启动时调一次。"""
    from math_edu.models import Base

    init_engine()
    Base.metadata.create_all(_engine)
