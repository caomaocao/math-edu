# -*- coding: utf-8 -*-
"""进度路由。01 立空骨架，04 在此补 GET /api/progress、PUT /api/progress/{storage_key}。

后端对 payload 完全不透明：整包 jsonb 存取，不解读、不做键白名单（校验就要每讲登记，
恰好毁掉「加一讲零后端改动」）。滥用面由登录墙 + 单键 64KB 上限封住。

契约（05 同步模块照这个接）：
  GET  /api/progress
       → 当前用户全部进度，一次拿全：{存储键: {"payload": <整包>, "updated_at": <iso8601>}}
  PUT|POST  /api/progress/{storage_key}
       body = 该键在 localStorage 里那份带版本 JSON 的**原样整包**（就是请求体本身，
       不再套一层 {"payload": ...}）。服务端盖 updated_at、按 (user_id, storage_key) upsert。
       单键 payload 上限 64KB（超限 413）。body 原样读、自己解析 JSON —— 兼容 sendBeacon
       兜底提交（content-type 可能不规范甚至缺失）。**POST 与 PUT 同一 handler**：
       navigator.sendBeacon 只会发 POST（浏览器没给选方法的余地），只挂 PUT 的话
       pagehide 兜底每次都 405、还静默看不见 —— 这不是宽容，是那条兜底路的存在前提。

未登录 → 401（AuthGate 已保证，handler 再兜底一手）；AUTH_MODE=off → 404（端点不该被调）。
"""
import json

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert

# 顶层直接 import 数据层：auth.py 的 import 链早已无条件加载 db/models（app.py 两模式都挂
# auth.router），在这里装「惰性」不买任何东西。off 模式的不变量靠 engine 惰性初始化守着
#（import ≠ 连接，见 db.py），不靠 import 时机。
from math_edu.auth_gate import current_user_id
from math_edu.db import get_session
from math_edu.models import Progress
from math_edu.settings import AUTH_ON

router = APIRouter()

# 单键 payload 上限：正常进度远小于此，64KB 是防滥用的天花板而非工作尺寸。
# 量的是请求体字节数 —— 请求体本身就是要落库的整包，最直接也最省（超限就不必解析）。
_MAX_BYTES = 64 * 1024


def _require_login(request: Request) -> int:
    """两模式的防呆闸：off 模式端点根本不该被调（前端 me 探针会休眠）→ 404；
    on 模式未登录 → 401（AuthGate 通常已挡下，这里再兜底一手，不依赖中间件的存在）。"""
    if not AUTH_ON:
        raise HTTPException(status_code=404)
    user_id = current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")
    return user_id


@router.get("/api/progress")
def read_all_progress(request: Request):
    """当前用户全部进度，一次拿全。开机同步只发这一个请求。"""
    user_id = _require_login(request)

    session = get_session()
    try:
        rows = session.query(Progress).filter(Progress.user_id == user_id).all()
        return {
            r.storage_key: {
                "payload": r.payload,
                "updated_at": r.updated_at.isoformat(),
            }
            for r in rows
        }
    finally:
        session.close()


@router.put("/api/progress/{storage_key:path}")
@router.post("/api/progress/{storage_key:path}")
async def put_one_key(storage_key: str, request: Request):
    """把一个 localStorage 键的整包 upsert 进库。同键二次写覆盖、updated_at 更新、不长新行。

    storage_key 是 localStorage 的键，含冒号和中文（如 `cube-fold:进度:v2`）。用 `:path`
    路径参数容特殊字符，FastAPI 已 URL 解码，这里对解码后的键原样入库。
    PUT 是常规推送；POST 是 sendBeacon 的（它只会发 POST），两者同语义，见模块头。
    """
    user_id = _require_login(request)

    # 原样读请求体、自己解析 JSON：不走 pydantic body，才容得下 sendBeacon 那些不规范
    # （甚至缺失）的 content-type。
    body = await request.body()
    if len(body) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="进度整包超过 64KB 上限")
    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="请求体不是合法 JSON")

    session = get_session()
    try:
        # Postgres 原子 upsert：命中 (user_id, storage_key) 唯一约束就覆盖 payload 并重盖
        # updated_at，否则插新行。func.now() 是服务端时钟（事务开始时刻），客户端说了不算。
        stmt = (
            pg_insert(Progress)
            .values(
                user_id=user_id,
                storage_key=storage_key,
                payload=payload,
                updated_at=func.now(),
            )
            .on_conflict_do_update(
                constraint="uq_progress_user_key",
                set_={"payload": payload, "updated_at": func.now()},
            )
            .returning(Progress.updated_at)
        )
        updated_at = session.execute(stmt).scalar_one()
        session.commit()
        return {"ok": True, "updated_at": updated_at.isoformat()}
    finally:
        session.close()
