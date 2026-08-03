# -*- coding: utf-8 -*-
"""登录墙：AUTH_MODE=on 时挂在最内层，未登录一律挡在门外。

白名单只有登录页、认证 API、健康检查、favicon。其余：
  - 页面请求（GET html / 静态）未登录 → 302 到 /登录
  - API 请求未登录 → 401

Basic Auth 摘除后，这道墙就是站在 DashScope 账单和陌生人之间的唯一一道门
（.scratch/accounts/00-spec.md）。它只在 on 模式安装；off 模式下本模块不参与请求路径。
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse

LOGIN_PATH = "/login"

# 未登录也放行的路径：登录页自己、认证接口、健康检查、favicon。
_WHITELIST_EXACT = {LOGIN_PATH, "/api/health", "/favicon.ico"}
_WHITELIST_PREFIX = ("/api/auth/",)


def _whitelisted(path: str) -> bool:
    if path in _WHITELIST_EXACT:
        return True
    return any(path.startswith(p) for p in _WHITELIST_PREFIX)


def current_user_id(request: Request) -> int | None:
    """当前登录用户 id，未登录返回 None。02/04 的端点共用这一个真相源。

    off 模式下没有 SessionMiddleware，request.session 会抛 —— 那时本函数不该被调用
    （端点自己先查 AUTH_ON）。这里对缺失 session 也做兜底，返回 None 而不是抛。
    """
    try:
        return request.session.get("user_id")
    except (AssertionError, KeyError, AttributeError):
        return None


class AuthGateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if _whitelisted(path):
            return await call_next(request)

        user_id = current_user_id(request)
        if user_id:
            request.state.user_id = user_id
            return await call_next(request)

        if path.startswith("/api/"):
            return JSONResponse({"detail": "未登录"}, status_code=401)
        return RedirectResponse(LOGIN_PATH, status_code=302)
