# -*- coding: utf-8 -*-
"""全站入口：一个 FastAPI 进程扛起首页 + 各讲 + 语音三接口。

  /                首页，章节选择卡片（server-rendered，扫 chapters/ 生成）
  /ch/<章节目录>/   各讲静态站（每讲一个子目录，自带 index.html）
  /shared/         浏览器共享库（语音九件套 + three.js vendor，ticket 03 填充）
  /api/tts /api/asr /api/judge /api/health   语音三件套 + 健康检查
"""

import json
from html import escape
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from math_edu.api import asr, auth, health, judge, progress, tts, vision
from math_edu.auth_gate import AuthGateMiddleware, LOGIN_PATH
from math_edu.settings import (
    ALIYUN_CAPTCHA_APP_ID,
    AUTH_ON,
    CACHE_PROFILE,
    CHAPTERS_DIR,
    SECURE_COOKIES,
    SESSION_MAX_AGE,
    SESSION_SECRET,
    SHARED_DIR,
    WEB_DIR,
)

DEFAULT_ICON = "📘"

# 家长伴读页：一讲写了就自动在首页卡片上长出「家长」角标，没写就没有角标。
# 「存在才显示」是这里唯一的机制 —— 后来的讲不用改一行后端代码就能获得入口。
PARENT_PAGE = "家长.html"

# 站级使用指南：与讲无关，全站一页，讲「网站怎么用、出问题怎么办」
# （家长伴读页讲的是「这一讲教什么、答案是什么」，两者别混）。
GUIDE_PAGE = WEB_DIR / "指南.html"


def _load_manifest(chapter_dir) -> dict:
    manifest_path = chapter_dir / "manifest.json"
    if manifest_path.exists():
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            data = {}
    else:
        data = {}
    title = data.get("title") or chapter_dir.name
    subtitle = data.get("subtitle") or ""
    return {
        "title": title,
        "subtitle": subtitle,
        # 英文课的卡片文字：讲自己在 manifest 里补 title_en / subtitle_en，
        # 没补就回落中文（漏译看得见，但入口不会变空白）。
        "title_en": data.get("title_en") or title,
        "subtitle_en": data.get("subtitle_en") or subtitle,
        "icon": data.get("icon") or DEFAULT_ICON,
        "entry": data.get("entry") or "index.html",
        "parent_page": (chapter_dir / PARENT_PAGE).is_file(),
    }


def _discover_chapters() -> list[dict]:
    CHAPTERS_DIR.mkdir(parents=True, exist_ok=True)
    chapters = []
    for entry in sorted(CHAPTERS_DIR.iterdir()):
        if not entry.is_dir():
            continue
        manifest = _load_manifest(entry)
        chapters.append({"dirname": entry.name, **manifest})
    return chapters


def _bilingual_attrs(cn: str, en: str) -> str:
    """双语文案挂在元素上，页内 JS 用「语言」模块的 选() 决定露哪一句。"""
    return f'data-cn="{escape(cn, quote=True)}" data-en="{escape(en, quote=True)}"'


def _render_card(c: dict) -> str:
    href = f"/ch/{quote(c['dirname'])}/"
    badge = ""
    if c["parent_page"]:
        # 有家长页才有角标 —— 没写家长页的讲，这里什么都不长出来
        badge = (
            f'\n        <a class="家长角标" href="{href}{quote(PARENT_PAGE)}"\n'
            f'           {_bilingual_attrs("家长", "Parents")}>家长</a>'
        )
    return f"""      <div class="卡位">
        <a class="card" href="{href}">
          <span class="icon">{escape(c['icon'])}</span>
          <span class="title" {_bilingual_attrs(c['title'], c['title_en'])}>{escape(c['title'])}</span>
          <span class="subtitle" {_bilingual_attrs(c['subtitle'], c['subtitle_en'])}>{escape(c['subtitle'])}</span>
        </a>{badge}
      </div>"""


def _render_parent_link(c: dict) -> str:
    """指南页尾的一条家长伴读页链接。指南是中文单语，这里不挂双语属性。"""
    href = f"/ch/{quote(c['dirname'])}/{quote(PARENT_PAGE)}"
    sub = f'<span class="细">{escape(c["subtitle"])}</span>' if c["subtitle"] else ""
    return (
        f'          <a class="伴读" href="{href}">\n'
        f'            <span class="图">{escape(c["icon"])}</span>\n'
        f'            <span class="话"><b>{escape(c["title"])}</b>{sub}</span>\n'
        f"          </a>"
    )


def _render_guide(chapters: list[dict]) -> str:
    """把页尾那排家长页链接注进指南页。

    链接**不写死在 HTML 里**：和首页卡片同一个套路（模板留注释锚点，服务端换掉），
    判断也是同一套「存在才显示」。将来加第 4 讲，页尾自动跟上——没有可漂移的余地，
    也就不需要一条红线去守它。能用结构解决的，别用测试解决。
    """
    links = "\n".join(_render_parent_link(c) for c in chapters if c["parent_page"])
    if not links:
        # 一讲都没写家长页时给句人话，别留一块空白。
        # （不靠 CSS 的 :empty —— 锚点两边的换行本身就是文本节点，那条规则永远不会命中。）
        links = '          <p class="说">还没有任何一讲写了家长伴读页。</p>'
    return GUIDE_PAGE.read_text(encoding="utf-8").replace("<!--家长页-->", links)


# 大段模板不用 f-string：CSS / JS 里全是花括号，转义一遍反而看不清。
# 动态部分只有卡片这一处，用注释当锚点换掉。
_HOME_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>大班数学 · 章节选择</title>
  <link rel="stylesheet" href="/shared/css/语言开关.css" />
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif;
      background: linear-gradient(180deg, #eef4ff 0%, #f7fafc 100%);
      min-height: 100vh;
      /* iPhone 上的 100vh 是「工具栏收起时」的高度，所以哪怕内容只有一屏，页面天生也
         多出一截可滚。dvh 量的是当下真的看得见的那块。读不懂 dvh 的浏览器停在上一行。 */
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4rem 1.5rem;
      box-sizing: border-box;
    }
    h1 {
      font-size: 1.75rem;
      color: #1f2d3d;
      margin-bottom: 0.25rem;
    }
    p.lede {
      color: #5a6b7d;
      margin-top: 0;
      margin-bottom: 2.5rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      width: 100%;
      max-width: 900px;
    }
    .卡位 { position: relative; display: flex; }
    .card {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      background: #ffffff;
      border-radius: 18px;
      padding: 2rem 1.25rem;
      box-shadow: 0 6px 20px rgba(31, 45, 61, 0.08);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    /* 卡片浮起来只是装饰，所以关进 hover: hover：触屏上点过的卡会把 hover 粘住不散，
       孩子退回首页会看见一张自己浮着的卡片，像是选中了什么。 */
    @media (hover: hover) {
      .card:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 28px rgba(31, 45, 61, 0.14);
      }
    }
    .card .icon { font-size: 2.75rem; }
    .card .title { font-size: 1.15rem; font-weight: 600; color: #1f2d3d; }
    .card .subtitle { font-size: 0.9rem; color: #7a8a9a; }
    .empty { color: #7a8a9a; }

    /* 家长角标：家长的入口，要一眼找得到（第一版又小又淡，家长自己都看不见）。
       防孩子误点靠的从来不是「藏」，而是它是一段**字**、无图标、不动弹——
       不认字的孩子对文字按钮没兴趣，认字的大人对文字最敏感（讲内的家长钮
       同一个道理）。所以尺寸、描边、投影都给足，色彩仍然收着不抢卡片。 */
    /* 「使用指南」入口和「家长」角标是同一族胶囊，长相只写一遍：两处都是给大人的
       文字入口，一旦分成两份迟早会长歪（共享组件那两次漂移就是这么来的）。
       位置各管各的：角标贴卡片右上，指南入口固定在左上角，和右上角的语言开关左右呼应。 */
    .家长角标, .指南入口 {
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      line-height: 1;
      padding: 0.5rem 0.95rem;
      border-radius: 999px;
      color: #3b556e;
      background: #ffffff;
      border: 1.5px solid #b8c6d4;
      box-shadow: 0 2px 8px rgba(31, 45, 61, 0.10);
      text-decoration: none;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .家长角标 { position: absolute; top: 0.8rem; right: 0.8rem; }
    .指南入口 { position: fixed; top: 1rem; left: 1.25rem; z-index: 5; }
    @media (hover: hover) {
      .家长角标:hover, .指南入口:hover { background: #eef4fa; border-color: #7d97b0; color: #1f3b57; }
    }

    /* 语言开关的长相在 /shared/css/语言开关.css（两讲共用同一份），
       这儿只管摆在哪儿。孩子不认字，开关只能是图 —— 两面旗，亮着的是现在这门课。 */
    .语言开关 { position: fixed; top: 1rem; right: 1.25rem; }

    /* 手机竖屏（iPhone Air 402pt）。卡片网格本来就是 auto-fit，402 塞不下第二列就自己
       摊成一列，不用管；要收的是左右留白 —— 1.5rem × 2 在 402 上吃掉整整一成宽度。
       上边距不在这儿动：那是给语言开关让位的事，跟屏幕多宽无关，见下一块。

       没开 viewport-fit=cover：这一页唯一贴边的东西就是两个角上的固定件，默认的
       viewport-fit: auto 让浏览器自己把视口缩进刘海以内，正好省掉一整套 env() 留边。 */
    @media (max-width: 640px) {
      body { padding-left: 1rem; padding-right: 1rem; padding-bottom: 3rem; }
      p.lede { margin-bottom: 1.75rem; }
      /* 手机上两处胶囊一起长半圈（34 → 39px 高），长相仍然只写一遍。家长角标「不抢戏」
         靠的是它是一段字、不是靠小到大人按不着 —— 按不着的入口等于没有入口。 */
      .家长角标, .指南入口 { padding: 0.65rem 1.05rem; }
    }

    /* 触屏上语言开关会自己长大（/shared/css/语言开关.css 的 pointer: coarse 那段：
       两面旗各撑到 --旗靶）。这里两件事跟着调，都只在粗指针下：

       一是把 --旗靶 从 80px 调到 60px。80 是**基准舞台**上的数字，讲里整台缩到手机上
       才等于 44pt 上下；首页不在舞台上，80px 就是实打实的 80pt，一颗 172×88 的药丸压在
       402 宽的页角上，比它旁边的标题还抢眼。60px（药丸 132×68）在手机上仍然远高于 44pt
       的舒适下限，孩子按得准。
       二是顶边让出位置：药丸底边落在 84px，而 h1 是居中的一行，英文标题
       （Mobi Loves Math 比中文宽一倍）横向正好伸到药丸底下 —— 只能靠上边距把标题压下去。
       写成 padding-top 单独一条，好让上一块那些左右/下留白怎么改都不会把它冲掉。 */
    @media (pointer: coarse) {
      .语言开关 { --旗靶: 60px; }
      body { padding-top: 5rem; }
    }

    @media (prefers-color-scheme: dark) {
      body { background: linear-gradient(180deg, #10151c 0%, #171d26 100%); }
      h1 { color: #f0f3f7; }
      p.lede { color: #9aabbd; }
      .card { background: #1c2430; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35); }
      .card .title { color: #f0f3f7; }
      .家长角标, .指南入口 { color: #cbd7e3; background: #232d3b; border-color: #45566b; }
      .语言开关 {
        --旗底: rgba(28, 36, 48, 0.9);
        --旗影: 0 4px 14px rgba(0, 0, 0, 0.4);
        --旗选中底: rgba(255, 255, 255, 0.12);
      }
    }

    /* 深色下的悬停也是装饰，同样只发给有真指针的设备。写成 and 而不是套在深色块里，
       是为了让它排在上面那条浅色 hover 规则之后 —— 顺序就是深色赢的唯一理由。 */
    @media (prefers-color-scheme: dark) and (hover: hover) {
      .家长角标:hover, .指南入口:hover { background: #2c3a4d; border-color: #64809c; color: #eef4fa; }
    }
  </style>
</head>
<body>
  <div id="语言角"></div>
  <a class="指南入口" href="/guide" data-cn="使用指南" data-en="Guide">使用指南</a>
  <h1 data-cn="大班数学" data-en="Pre-K Math">大班数学</h1>
  <p class="lede" data-cn="选一讲开始" data-en="Pick a lesson to start">选一讲开始</p>
  <div class="grid">
<!--卡片-->
  </div>

  <script type="module">
    import { 当前语言, 订阅语言, 选 } from '/shared/js/语言.js';
    import { 装语言开关 } from '/shared/js/语言开关.js';

    const 页名 = { cn: '大班数学 · 章节选择', en: 'Pre-K Math · Lessons' };

    // 单击即切，不问第二遍：换语言不清任何东西，和「重来」的风险不是一回事
    装语言开关(document.getElementById('语言角'));

    function 上文案() {
      // 服务端把中文先渲染好了，这里按当前语言把每条双语文案换成该露的那一句
      for (const 元 of document.querySelectorAll('[data-cn]')) {
        元.textContent = 选({ cn: 元.dataset.cn, en: 元.dataset.en });
      }
      document.title = 选(页名);
      document.documentElement.lang = 当前语言() === 'en' ? 'en' : 'zh-CN';
    }

    订阅语言(上文案);
    上文案();
  </script>
</body>
</html>
"""


def _render_home(chapters: list[dict]) -> str:
    if chapters:
        cards = "\n".join(_render_card(c) for c in chapters)
    else:
        cards = (
            '      <p class="empty" data-cn="还没有任何一讲 —— 把内容放进 chapters/ 目录试试。"'
            ' data-en="No lessons yet — drop one into the chapters/ folder.">'
            "还没有任何一讲 —— 把内容放进 chapters/ 目录试试。</p>"
        )
    return _HOME_TEMPLATE.replace("<!--卡片-->", cards)


def create_app() -> FastAPI:
    app = FastAPI()

    app.include_router(health.router)
    app.include_router(tts.router)
    app.include_router(asr.router)
    app.include_router(judge.router)
    app.include_router(vision.router)
    # 账号体系。两个 router 无条件挂上（/api/auth/me 两模式都要答；进度端点在 on 模式由
    # AuthGate 401 未登录请求，在 off 模式前端 me 探针即休眠不会调它）。02/04 只填这两个
    # 文件的内部，不再碰 app.py —— 这样 02、04 可并行且不撞共享文件。
    app.include_router(auth.router)
    app.include_router(progress.router)

    chapters = _discover_chapters()

    @app.get("/", response_class=HTMLResponse)
    def home():
        return _render_home(_discover_chapters())

    @app.get("/guide", response_class=HTMLResponse)
    def guide():
        return _render_guide(_discover_chapters())

    # 旧中文路由 301 到新址：上线头几天的书签/聊天记录里可能存着旧链接，别让它们断。
    # URL 一律 ASCII（地址栏和日志里 %E6%8C%87%E5%8D%97 太难看）；中文只留给文件名（家规）。
    @app.get("/指南")
    def guide_legacy():
        return RedirectResponse("/guide", status_code=301)

    @app.get("/登录")
    def login_legacy():
        return RedirectResponse(LOGIN_PATH, status_code=301)

    @app.get(LOGIN_PATH, response_class=HTMLResponse)
    def login_page(request: Request):
        """登录页（成人页）。off 模式无此页（404）；on 模式已登录访问则回首页。

        照 /guide 的「渲染文件而非字符串模板」套路：web/登录.html 手写自包含，服务端只把
        <!--CAPTCHA_APP_ID--> 换成真实 app_id。03 填页面内容，本路由不用再改。
        """
        if not AUTH_ON:
            raise HTTPException(status_code=404)
        if request.session.get("user_id"):
            return RedirectResponse("/", status_code=302)
        html = (WEB_DIR / "登录.html").read_text(encoding="utf-8")
        html = html.replace("<!--CAPTCHA_APP_ID-->", escape(ALIYUN_CAPTCHA_APP_ID))
        return HTMLResponse(html)

    @app.middleware("http")
    async def apply_cache_profile(request, call_next):
        """Stamp Cache-Control on every response, chosen by settings.CACHE_PROFILE.

        Why this middleware exists at all (the `dev` side, unchanged): StaticFiles sends
        ETag/Last-Modified but no Cache-Control, so browsers fall back to *heuristic*
        caching and may serve a stale module or stylesheet for hours. On the parent's own
        machine that is pure downside — the site runs off local disk for one child — so we
        tell the browser to revalidate everything (`no-cache`). Revalidation costs a 304 on
        localhost, and in exchange an edited lesson is never silently the old one. (Learned
        the hard way: a whole chapter's worth of restyled art appeared not to render,
        because the browser was still running yesterday's JavaScript.) That is still the
        right trade for local development, and is the `dev` profile — also the default, so
        an unconfigured process behaves exactly as it always did.

        On the public ECS the trade flips, and that is the `public` profile. Every warm
        open of a lesson was 40-odd requests that all 304'd — each a full round-trip over
        the proxy — so a page that should be instant took a second. There the browser
        *should* trust its cache and revalidate quietly (stale-while-revalidate); an update
        lands on the next open at the latest. `public` layers by URL path:

          - Entity art and the vendored three.js change little and rarely — a day of hard
            cache plus a month of SWR. A regenerated image reaches the child the next day
            at worst, which the child cannot tell from a month.
          - Everything else (JS/CSS/HTML) — max-age=0 so the browser always revalidates,
            but a week of SWR so it serves the cached copy instantly and checks in the
            background. A code change lands on the next open.

        Both profiles stamp with `setdefault`, so /api/tts's own one-year Cache-Control
        (api/tts.py) always wins — a synthesized mp3 stays hard-cached in either mode.
        """
        response = await call_next(request)
        if CACHE_PROFILE == "public":
            path = request.url.path
            if path.startswith("/shared/assets/实体图/") or path.startswith(
                "/shared/vendor/three/"
            ):
                cache_control = "max-age=86400, stale-while-revalidate=2592000"
            else:
                cache_control = "max-age=0, stale-while-revalidate=604800"
        else:
            cache_control = "no-cache"
        response.headers.setdefault("Cache-Control", cache_control)
        return response

    SHARED_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/shared", StaticFiles(directory=SHARED_DIR), name="shared")

    for chapter in chapters:
        app.mount(
            f"/ch/{chapter['dirname']}",
            StaticFiles(directory=CHAPTERS_DIR / chapter["dirname"], html=True),
            name=f"chapter-{chapter['dirname']}",
        )

    # 登录墙只在 on 模式立起。加在最后 —— add_middleware 后加者在外层，故 Session 包在
    # AuthGate 外面，AuthGate 才读得到 request.session。off 模式这两行都不执行：进程零
    # 数据库连接、零会话中间件，本机开发/离线与账号体系上线前逐字节一致。
    if AUTH_ON:
        from starlette.middleware.sessions import SessionMiddleware

        from math_edu.db import create_all

        create_all()  # 五张表 CREATE IF NOT EXISTS，首启即就绪
        app.add_middleware(AuthGateMiddleware)
        # cookie 形态（__Host-+Secure vs 普通）为什么跟 CACHE_PROFILE 走：见 settings.SECURE_COOKIES。
        app.add_middleware(
            SessionMiddleware,
            secret_key=SESSION_SECRET,
            session_cookie="__Host-session" if SECURE_COOKIES else "session",
            max_age=SESSION_MAX_AGE,
            https_only=SECURE_COOKIES,
            same_site="lax",
        )

    return app


app = create_app()


if __name__ == "__main__":
    import os

    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", "8300")))
