# -*- coding: utf-8 -*-
"""阿里云验证客户端 —— 从 wechat_screen_detect/web/captcha.py 近乎原样移植。

两个相互独立的客户端：

1. AliyunImageCaptchaClient（图形验证码 v4 / 极验融合）
   - 服务端二次校验：HMAC-SHA256(lot_number, app_key) → POST /validate
   - fail-closed：网络异常 / 非 200 / 解析失败一律判**不通过**，不降级放行。

2. AliyunSmsVerifyClient（短信验证码 / Dypnsapi）
   - send_verify_code：阿里云生成验证码并发送短信
   - check_verify_code：服务端校验用户输入（同码只过一次，由阿里云侧保证）

与参考实现的唯一区别：删掉 `from config import Config`（本仓库没有 config.yaml 那层），
凭据一律从 math_edu.settings 读；显式传参仍可覆盖（测试/试音用）。日志手机号一律脱敏。
"""
from __future__ import annotations

import hmac
import json
import logging
from typing import Optional

import httpx
from alibabacloud_dypnsapi20170525 import models as dypnsapi_models
from alibabacloud_dypnsapi20170525.client import Client as Dypnsapi20170525Client
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_tea_util import models as util_models
from pydantic import BaseModel

from math_edu import settings

logger = logging.getLogger(__name__)


def mask_phone(phone: str) -> str:
    """脱敏手机号用于日志：13812345678 → 138****5678。"""
    if not phone:
        return ""
    if len(phone) < 7:
        return "*" * len(phone)
    return f"{phone[:3]}****{phone[-4:]}"


# ---------------------------------------------------------------------------
# 1. 图形验证码（Aliyun H5 Captcha v4）
# ---------------------------------------------------------------------------

DEFAULT_CAPTCHA_API_SERVER = "https://captcha.alicaptcha.com"
_FAIL_CLOSED_REASON = "request captcha api fail"


class ImageCaptchaResult(BaseModel):
    """图形验证码二次校验结果。

    success: 业务层应只信此字段（status==success 且 result==success）。
    passed:  与 success 同义，保留以与 SMS check 风格一致。
    """

    success: bool
    passed: bool
    status: str = ""
    result: str = ""
    reason: str = ""
    code: Optional[str] = None
    message: str = ""
    captcha_args: dict = {}
    raw: dict = {}


class AliyunImageCaptchaClient:
    """阿里云 H5 图形验证码（v4）服务端校验客户端。

    错误处理为 fail-closed：网络异常 / 非 200 / 解析失败均返回 success=False，
    不向上抛异常，也不降级放行。
    """

    def __init__(
        self,
        app_id: Optional[str] = None,
        app_key: Optional[str] = None,
        api_server: str = DEFAULT_CAPTCHA_API_SERVER,
        timeout: float = 5.0,
    ) -> None:
        resolved_id = app_id or settings.ALIYUN_CAPTCHA_APP_ID
        resolved_key = app_key or settings.ALIYUN_CAPTCHA_APP_KEY
        if not resolved_id or not resolved_key:
            raise ValueError(
                "未配置阿里云图形验证码凭据：请设置 ALIYUN_CAPTCHA_APP_ID/"
                "ALIYUN_CAPTCHA_APP_KEY，或显式传入 app_id/app_key"
            )
        self.app_id = resolved_id
        self.app_key = resolved_key
        self.api_server = api_server.rstrip("/")
        self.timeout = timeout
        self._http_client = httpx.Client(timeout=timeout)

    def _sign(self, lot_number: str) -> str:
        return hmac.new(
            self.app_key.encode(),
            lot_number.encode(),
            digestmod="sha256",
        ).hexdigest()

    def verify(
        self,
        lot_number: str,
        captcha_output: str,
        pass_token: str,
        gen_time: str,
    ) -> ImageCaptchaResult:
        """提交前端 4 字段到阿里云做二次校验。"""
        sign_token = self._sign(lot_number)
        form = {
            "lot_number": lot_number,
            "captcha_output": captcha_output,
            "pass_token": pass_token,
            "gen_time": gen_time,
            "sign_token": sign_token,
        }
        url = f"{self.api_server}/validate"
        logger.info(
            "二次校验图形验证码: lot_number=%s gen_time=%s", lot_number, gen_time
        )

        try:
            resp = self._http_client.post(
                url,
                params={"captcha_id": self.app_id},
                data=form,
            )
        except httpx.HTTPError as exc:
            logger.warning("二次校验请求异常（fail-closed）: %s", exc)
            return ImageCaptchaResult(
                success=False, passed=False, reason=_FAIL_CLOSED_REASON
            )

        if resp.status_code != 200:
            logger.warning(
                "二次校验非 200（fail-closed）: status=%s body=%s",
                resp.status_code,
                resp.text[:200],
            )
            return ImageCaptchaResult(
                success=False,
                passed=False,
                reason=_FAIL_CLOSED_REASON,
                raw={"status_code": resp.status_code, "body": resp.text},
            )

        try:
            body = resp.json()
        except ValueError as exc:
            logger.warning("二次校验响应非 JSON（fail-closed）: %s", exc)
            return ImageCaptchaResult(
                success=False, passed=False, reason=_FAIL_CLOSED_REASON
            )

        status = str(body.get("status", ""))
        result_str = str(body.get("result", ""))
        passed = result_str == "success"
        success = status == "success" and passed
        message = str(body.get("message") or body.get("msg") or "")
        code = body.get("code")
        outcome = ImageCaptchaResult(
            success=success,
            passed=passed,
            status=status,
            result=result_str,
            reason=str(body.get("reason", "")),
            code=str(code) if code is not None else None,
            message=message,
            captcha_args=body.get("captcha_args") or {},
            raw=body,
        )
        if outcome.success:
            logger.info("二次校验通过: lot_number=%s", lot_number)
        else:
            logger.warning(
                "二次校验未通过: status=%s result=%s reason=%s code=%s",
                outcome.status,
                outcome.result,
                outcome.reason,
                outcome.code,
            )
        return outcome

    def close(self) -> None:
        self._http_client.close()


# ---------------------------------------------------------------------------
# 2. 短信验证码（Aliyun Dypnsapi）
# ---------------------------------------------------------------------------

DEFAULT_SMS_ENDPOINT = "dypnsapi.aliyuncs.com"


class SendVerifyCodeResult(BaseModel):
    """发送验证码返回结果（精简后的关键字段）。"""

    success: bool
    code: str
    message: str
    request_id: Optional[str] = None
    biz_id: Optional[str] = None
    out_id: Optional[str] = None
    verify_code: Optional[str] = None
    raw: dict


class CheckVerifyCodeResult(BaseModel):
    """校验验证码返回结果。"""

    success: bool
    passed: bool
    code: str
    message: str
    request_id: Optional[str] = None
    out_id: Optional[str] = None
    raw: dict


class AliyunSmsVerifyClient:
    """阿里云号码认证服务（Dypnsapi）短信验证码客户端。

    凭据加载顺序：显式传参 → math_edu.settings（RAM 主账号 AK/SK）。
    Client 实例线程安全，建议进程内单例复用。
    """

    def __init__(
        self,
        access_key_id: Optional[str] = None,
        access_key_secret: Optional[str] = None,
        endpoint: str = DEFAULT_SMS_ENDPOINT,
    ) -> None:
        ak = access_key_id or settings.ALIBABA_CLOUD_ACCESS_KEY_ID
        sk = access_key_secret or settings.ALIBABA_CLOUD_ACCESS_KEY_SECRET
        if not ak or not sk:
            raise ValueError(
                "未配置阿里云凭据：请设置 ALIBABA_CLOUD_ACCESS_KEY_ID/"
                "ALIBABA_CLOUD_ACCESS_KEY_SECRET，或显式传入 access_key_id/access_key_secret"
            )
        config = open_api_models.Config(access_key_id=ak, access_key_secret=sk)
        config.endpoint = endpoint
        self._client = Dypnsapi20170525Client(config)

    def send_verify_code(
        self,
        phone_number: str,
        sign_name: str,
        template_code: str,
        template_param: Optional[dict] = None,
    ) -> SendVerifyCodeResult:
        """发送短信验证码。

        :param phone_number: 11 位手机号（不带国家码）
        :param sign_name:    短信签名
        :param template_code: 模板 code
        :param template_param: 模板变量；占位 ##code## 由阿里云自动生成填入。
        """
        req = dypnsapi_models.SendSmsVerifyCodeRequest(
            sign_name=sign_name,
            template_code=template_code,
            phone_number=phone_number,
            template_param=json.dumps(template_param) if template_param else None,
        )
        runtime = util_models.RuntimeOptions()
        logger.info(
            "发送短信验证码: phone=%s template=%s", mask_phone(phone_number), template_code
        )
        resp = self._client.send_sms_verify_code_with_options(req, runtime)
        body = _body_to_dict(resp.body)
        model = body.get("Model") or {}
        result = SendVerifyCodeResult(
            success=bool(body.get("Success")),
            code=str(body.get("Code", "")),
            message=str(body.get("Message", "")),
            request_id=body.get("RequestId"),
            biz_id=model.get("BizId"),
            out_id=model.get("OutId"),
            verify_code=model.get("VerifyCode"),
            raw=body,
        )
        if result.success:
            logger.info("发送成功: request_id=%s biz_id=%s", result.request_id, result.biz_id)
        else:
            logger.warning("发送失败: code=%s message=%s", result.code, result.message)
        return result

    def check_verify_code(
        self,
        phone_number: str,
        verify_code: str,
    ) -> CheckVerifyCodeResult:
        """校验短信验证码（同一手机号 + 同一验证码只能校验一次成功）。

        fail-closed：码错时阿里云 SDK 直接抛 ClientException（isv.ValidateFail），
        以及任何网络/配置异常，一律收敛成 passed=False —— 宁可拒一个手滑的家长，
        也绝不因异常把人放进来。真码对了才 passed=True。
        """
        req = dypnsapi_models.CheckSmsVerifyCodeRequest(
            phone_number=phone_number,
            verify_code=verify_code,
        )
        runtime = util_models.RuntimeOptions()
        logger.info("校验短信验证码: phone=%s", mask_phone(phone_number))
        try:
            resp = self._client.check_sms_verify_code_with_options(req, runtime)
        except Exception as exc:  # noqa: BLE001 — 校验一律 fail-closed
            code = str(getattr(exc, "code", "") or "")
            message = str(getattr(exc, "message", "") or exc)
            logger.warning(
                "校验短信验证码异常（fail-closed 判不通过）: phone=%s code=%s message=%s",
                mask_phone(phone_number),
                code,
                message,
            )
            return CheckVerifyCodeResult(
                success=False,
                passed=False,
                code=code or "exception",
                message=message,
                raw={"exception": message, "code": code},
            )
        body = _body_to_dict(resp.body)
        model = body.get("Model") or {}
        passed = str(model.get("VerifyResult", "")).upper() == "PASS"
        result = CheckVerifyCodeResult(
            success=bool(body.get("Success")),
            passed=passed,
            code=str(body.get("Code", "")),
            message=str(body.get("Message", "")),
            request_id=body.get("RequestId"),
            out_id=model.get("OutId"),
            raw=body,
        )
        logger.info("校验结果: passed=%s code=%s message=%s", passed, result.code, result.message)
        return result


def _body_to_dict(body) -> dict:
    if hasattr(body, "to_map"):
        return body.to_map()
    if isinstance(body, dict):
        return body
    return dict(body)


__all__ = [
    "mask_phone",
    # 图形验证码
    "AliyunImageCaptchaClient",
    "ImageCaptchaResult",
    "DEFAULT_CAPTCHA_API_SERVER",
    # 短信验证码
    "AliyunSmsVerifyClient",
    "SendVerifyCodeResult",
    "CheckVerifyCodeResult",
    "DEFAULT_SMS_ENDPOINT",
]
