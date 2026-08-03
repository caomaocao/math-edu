# -*- coding: utf-8 -*-
"""全站配置：从仓库根 .env 读取，密钥只在这里读，不进代码。"""

import os
from pathlib import Path

from dotenv import load_dotenv

# repo 根：src/math_edu/settings.py -> src/math_edu -> src -> 根
REPO_ROOT = Path(__file__).resolve().parent.parent.parent

load_dotenv(REPO_ROOT / ".env")

API_KEY = os.environ.get("DASHSCOPE_API_KEY", "").strip()
if not API_KEY.isascii():  # .env 里还是「sk-你的key填这里」占位符
    API_KEY = ""

TTS_MODEL = os.environ.get("TTS_MODEL", "qwen-audio-3.0-tts-flash")
TTS_VOICE = os.environ.get("TTS_VOICE", "longjielidou_v3.6")
# 英文课用哪把嗓子。默认留空 = 用 TTS_VOICE 那一把 —— 龙杰力豆本来就中英双语
# （2026-07-27 复核官方音色表，无下线标），同一把童嗓说两种语言，两种模式人格一致。
# 想换纯美音成人嗓（loongeva_v3.6 女 / loongjohn 男）只改 .env，代码不动。
TTS_VOICE_EN = os.environ.get("TTS_VOICE_EN", "").strip()
ASR_MODEL = os.environ.get("ASR_MODEL", "fun-asr-flash-2026-06-15")
JUDGE_MODEL = os.environ.get("JUDGE_MODEL", "qwen3.5-omni-flash")
VISION_MODEL = os.environ.get("VISION_MODEL", "qwen3.6-flash")

# 静态资源缓存分流：本地开发（dev）保持「改完刷新就见新」，一切静态响应 no-cache；
# 公网（public）让浏览器直接用缓存秒开、后台静静校验（stale-while-revalidate）。
# 缺省 dev —— 不配置就和本机开发过去的行为完全一致。改行为是 .env 编辑（或起进程时
# 的环境变量 CACHE_PROFILE=public），不是代码修改。分层策略见 app.py 的中间件。
CACHE_PROFILE = os.environ.get("CACHE_PROFILE", "dev").strip().lower()

# ---- 账号体系（.scratch/accounts/ spec）----
# AUTH_MODE 照 CACHE_PROFILE 先例：缺省 off —— 本机开发/离线一切照旧，不连库、不碰阿里云。
# 公网 ECS 显式设 on 才整站上锁。改行为是 .env 编辑，不是代码修改。
AUTH_MODE = os.environ.get("AUTH_MODE", "off").strip().lower()
AUTH_ON = AUTH_MODE == "on"

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
SESSION_SECRET = os.environ.get("SESSION_SECRET", "").strip()
# 会话 180 天滑动续期：starlette 每次响应重发 cookie，只要半年内来过一次就不重登。
SESSION_MAX_AGE = 180 * 24 * 3600

# 阿里云图形验证码（验证码 2.0）与短信（Dypnsapi）—— 与 wechat_screen_detect 同一套账号。
ALIYUN_CAPTCHA_APP_ID = os.environ.get("ALIYUN_CAPTCHA_APP_ID", "").strip()
ALIYUN_CAPTCHA_APP_KEY = os.environ.get("ALIYUN_CAPTCHA_APP_KEY", "").strip()
ALIBABA_CLOUD_ACCESS_KEY_ID = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_ID", "").strip()
ALIBABA_CLOUD_ACCESS_KEY_SECRET = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_SECRET", "").strip()
SMS_SIGN_NAME = os.environ.get("SMS_SIGN_NAME", "").strip()
SMS_TEMPLATE_CODE = os.environ.get("SMS_TEMPLATE_CODE", "").strip()

# cookie 形态跟着「本机 vs ECS」走，复用 CACHE_PROFILE 这一已有信号，不另设开关：
# 公网（public，HTTPS）→ __Host- 前缀 + Secure；本机 on 模式自测走 HTTP → 普通 cookie，
# 否则 __Host-/Secure 在 http 下浏览器根本不存。会话 cookie（app.py）和 verify_sid
# （api/auth.py）都从这一处读，两枚 cookie 对 Secure 的意见永远一致。
SECURE_COOKIES = CACHE_PROFILE == "public"

# 必需配置清单：AUTH_MODE=on 时任一缺失即启动抛错。
# 不学 TTS 的优雅降级 —— 登录墙半残等于把所有人锁在门外还不报错，那是最坏的失败形状。
_AUTH_REQUIRED = {
    "DATABASE_URL": DATABASE_URL,
    "SESSION_SECRET": SESSION_SECRET,
    "ALIYUN_CAPTCHA_APP_ID": ALIYUN_CAPTCHA_APP_ID,
    "ALIYUN_CAPTCHA_APP_KEY": ALIYUN_CAPTCHA_APP_KEY,
    "ALIBABA_CLOUD_ACCESS_KEY_ID": ALIBABA_CLOUD_ACCESS_KEY_ID,
    "ALIBABA_CLOUD_ACCESS_KEY_SECRET": ALIBABA_CLOUD_ACCESS_KEY_SECRET,
    "SMS_SIGN_NAME": SMS_SIGN_NAME,
    "SMS_TEMPLATE_CODE": SMS_TEMPLATE_CODE,
}

if AUTH_ON:
    _missing = [name for name, val in _AUTH_REQUIRED.items() if not val]
    if _missing:
        raise RuntimeError(
            "AUTH_MODE=on 但缺少必需配置：" + "、".join(_missing) + "。"
            "登录墙需要这些凭据才能立起来；缺了就宁可启动即停，也不放一个"
            "谁都登不进、还不报错的残站上线。"
        )

CACHE_DIR = REPO_ROOT / "var" / "cache" / "tts"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

CHAPTERS_DIR = REPO_ROOT / "chapters"
WEB_DIR = REPO_ROOT / "web"
SHARED_DIR = WEB_DIR / "shared"

if API_KEY:
    import dashscope

    dashscope.api_key = API_KEY
