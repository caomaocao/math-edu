# -*- coding: utf-8 -*-
"""认证路由（登录注册合一，纯短信无密码，intent 只有一种）。

流程：图形验证（/captcha）→ 收短信（/sms，发码前先查资格）→ 提交（/login，老号登录/新号凭
邀请码注册）→ /logout 清会话。

/api/auth/* 全部在登录墙白名单里（未登录可达），所以每个端点自己先查登录态 / AUTH_ON。
off 模式无库、无会话中间件、无阿里云凭据，这些端点一律 404（登录只在公网 on 模式存在）。
"""
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from math_edu.aliyun import (
    AliyunImageCaptchaClient,
    AliyunSmsVerifyClient,
    mask_phone,
)
from math_edu.auth_service import (
    find_user_by_phone,
    find_valid_invite,
    is_eligible,
    register_user,
    valid_phone,
)
from math_edu.auth_gate import current_user_id
from math_edu.db import get_session
from math_edu.settings import (
    AUTH_ON,
    SECURE_COOKIES,
    SMS_SIGN_NAME,
    SMS_TEMPLATE_CODE,
)
from math_edu.verify_state import (
    INTENT,
    MAX_SENDS_PER_CAPTCHA,
    SESSION_TTL_SECONDS,
    check_sms_rate,
    destroy,
    get_or_create,
    load_session,
    now_utc,
    record_sms_send,
)

import logging

log = logging.getLogger(__name__)

router = APIRouter()

_VERIFY_COOKIE = "verify_sid"

# 阿里云客户端进程内单例。**惰性**创建：off 模式没有凭据，模块 import 时不能实例化
# （会 ValueError）；只有真走到认证端点（必然 AUTH_ON）才建。
_captcha_client: AliyunImageCaptchaClient | None = None
_sms_client: AliyunSmsVerifyClient | None = None


def _get_captcha_client() -> AliyunImageCaptchaClient:
    global _captcha_client
    if _captcha_client is None:
        _captcha_client = AliyunImageCaptchaClient()
    return _captcha_client


def _get_sms_client() -> AliyunSmsVerifyClient:
    global _sms_client
    if _sms_client is None:
        _sms_client = AliyunSmsVerifyClient()
    return _sms_client


def _require_auth_on() -> None:
    if not AUTH_ON:
        raise HTTPException(status_code=404)


def _set_verify_cookie(response: Response, sid: str) -> None:
    response.set_cookie(
        _VERIFY_COOKIE,
        sid,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="strict",
        secure=SECURE_COOKIES,
        path="/",
    )


def _clear_verify_cookie(response: Response) -> None:
    response.delete_cookie(
        _VERIFY_COOKIE,
        path="/",
        httponly=True,
        samesite="strict",
        secure=SECURE_COOKIES,
    )


class CaptchaBody(BaseModel):
    lot_number: str
    captcha_output: str
    pass_token: str
    gen_time: str


class SmsBody(BaseModel):
    phone: str
    invite_code: str | None = None


class LoginBody(BaseModel):
    phone: str
    code: str
    invite_code: str | None = None


@router.get("/api/auth/me")
def me(request: Request):
    """前端同步模块与登录页共用的探针。

    - AUTH_MODE=off：报 {auth:"off"}，前端同步模块见此即休眠，永不调 /api/progress。
    - on 且未登录：401。
    - on 且已登录：{user_id}。
    """
    if not AUTH_ON:
        return {"auth": "off"}
    uid = current_user_id(request)  # 登录态的单一真相源（auth_gate），不自己摸 session
    if not uid:
        raise HTTPException(status_code=401, detail="未登录")
    return {"auth": "on", "user_id": uid}


@router.post("/api/auth/captcha")
def captcha(request: Request, body: CaptchaBody, response: Response):
    """图形验证码四字段二次校验通过 → 在验证会话记 captcha_passed（并给一份新的 5 条短信预算）。

    fail-closed：阿里云侧网络异常/非 200 一律判不通过（见 aliyun.AliyunImageCaptchaClient）。
    """
    _require_auth_on()
    result = _get_captcha_client().verify(
        body.lot_number, body.captcha_output, body.pass_token, body.gen_time
    )
    if not result.success:
        raise HTTPException(
            status_code=400,
            detail={"error": "captcha_failed", "message": "图形验证未通过，请重试"},
        )

    db = get_session()
    try:
        sid = request.cookies.get(_VERIFY_COOKIE)
        sess = get_or_create(db, sid, INTENT)
        sess.captcha_passed_at = now_utc()
        # 每次图形验证通过都刷新一份预算：过一次验证码 = 一批（≤5）短信额度。
        sess.sms_send_count = 0
        sid_out = sess.sid
        db.commit()
    finally:
        db.close()

    _set_verify_cookie(response, sid_out)
    return {"captcha_passed": True}


@router.post("/api/auth/sms")
def sms(request: Request, body: SmsBody, response: Response):
    """发送短信验证码。先过图形验证 → 查资格（老用户或有效邀请码）→ 限频 → 发送 → 记流水。

    发码前查资格：陌生人（既非老用户又无有效邀请码）连短信都收不到，省短信费也挡盗刷。
    """
    _require_auth_on()
    phone = body.phone.strip()
    if not valid_phone(phone):
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_phone", "message": "手机号格式不正确"},
        )

    db = get_session()
    try:
        sid = request.cookies.get(_VERIFY_COOKIE)
        sess = load_session(db, sid, INTENT)
        if sess is None or sess.captcha_passed_at is None:
            db.commit()  # 落实惰性清理（若刚删过期行）
            raise HTTPException(
                status_code=400,
                detail={"error": "captcha_required", "message": "请先完成图形验证"},
            )

        # 单次图形验证最多放行 MAX_SENDS_PER_CAPTCHA 条：超出清 captcha_passed，须重新过验证码。
        # 挡「过一次验证码 → 轮换手机号反复发」的短信轰炸/盗刷。
        if sess.sms_send_count >= MAX_SENDS_PER_CAPTCHA:
            sess.captcha_passed_at = None
            db.commit()
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "captcha_required",
                    "message": "发送次数过多，请重新完成图形验证",
                },
            )

        # 发码前先查资格：不产生任何阿里云发送。
        if not is_eligible(db, phone, body.invite_code):
            db.commit()
            log.info("发码资格拒绝: phone=%s（非老用户且无有效邀请码）", mask_phone(phone))
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "not_eligible",
                    "message": "该手机号需要有效邀请码才能接收验证码",
                },
            )

        # per-phone 限频（超额抛 429），计的是 sms_sends 流水，重启不丢。
        check_sms_rate(db, phone)

        # 走到这里才真发短信（收费动作）。异常（阿里云 SDK 抛错）或 success=False 都
        # 收敛成 502，且不落流水、不增计数（record/increment 在成功之后才发生）。
        try:
            result = _get_sms_client().send_verify_code(
                phone_number=phone,
                sign_name=SMS_SIGN_NAME,
                template_code=SMS_TEMPLATE_CODE,
                template_param={"code": "##code##", "min": "5"},
            )
            sent_ok = result.success
            sent_code = result.code
        except Exception as exc:  # noqa: BLE001 — 发送失败给干净 502，不 500
            sent_ok = False
            sent_code = str(getattr(exc, "code", "") or exc)
        if not sent_ok:
            db.rollback()
            log.warning("短信发送失败: phone=%s code=%s", mask_phone(phone), sent_code)
            raise HTTPException(
                status_code=502,
                detail={"error": "sms_send_failed", "message": "短信发送失败，请稍后重试"},
            )

        sess.sms_target_phone = phone
        sess.sms_send_count += 1
        record_sms_send(db, phone)
        db.commit()
    finally:
        db.close()

    return {"sms_sent": True}


@router.post("/api/auth/login")
def login(request: Request, body: LoginBody, response: Response):
    """提交：校验短信码 → 老手机号直接开会话；新手机号验邀请码 → 建号 + 标记邀请码已用 + 开会话。

    邀请码在发码、提交两处都验（发码防浪费，提交防绕过）。同一短信码由阿里云侧保证只过一次。
    """
    _require_auth_on()
    phone = body.phone.strip()
    code = body.code.strip()
    if not valid_phone(phone):
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_phone", "message": "手机号格式不正确"},
        )
    if not code:
        raise HTTPException(
            status_code=400,
            detail={"error": "missing_code", "message": "请填写短信验证码"},
        )

    db = get_session()
    try:
        sid = request.cookies.get(_VERIFY_COOKIE)
        sess = load_session(db, sid, INTENT)
        if sess is None or sess.captcha_passed_at is None:
            db.commit()
            raise HTTPException(
                status_code=400,
                detail={"error": "captcha_required", "message": "请先完成图形验证"},
            )
        if sess.sms_target_phone != phone:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "sms_target_mismatch",
                    "message": "手机号与发送验证码时不一致，请重新发送",
                },
            )

        # 校验短信码（真调阿里云；同码只过一次由阿里云侧保证）。
        chk = _get_sms_client().check_verify_code(phone, code)
        if not chk.passed:
            raise HTTPException(
                status_code=400,
                detail={"error": "sms_code_invalid", "message": "验证码错误或已过期"},
            )

        user = find_user_by_phone(db, phone)
        registered = False
        if user is None:
            # 新手机号：提交处再验一次邀请码（防绕过发码资格）。
            invite = find_valid_invite(db, body.invite_code)
            if invite is None:
                # 短信码虽对，但没有有效邀请码：**不建号**。
                db.commit()
                log.info("注册被拒（无有效邀请码）: phone=%s", mask_phone(phone))
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "invite_required",
                        "message": "新用户需要有效邀请码才能注册",
                    },
                )
            user = register_user(db, phone, invite)
            registered = True
            log.info("新用户注册: phone=%s user_id=%s", mask_phone(phone), user.id)
        else:
            user.last_login_at = now_utc()
            log.info("老用户登录: phone=%s user_id=%s", mask_phone(phone), user.id)

        user_id = user.id
        request.session["user_id"] = user_id
        destroy(db, sess.sid)
        db.commit()
    finally:
        db.close()

    _clear_verify_cookie(response)
    return {"ok": True, "user_id": user_id, "registered": registered}


@router.post("/api/auth/logout")
def logout(request: Request):
    """清会话。登录页上一个不起眼的成人操作。"""
    if AUTH_ON and hasattr(request, "session"):
        request.session.clear()
    return {"ok": True}
