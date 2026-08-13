# CLAUDE.md

## What this is

大班数学配套网站 — a local, offline-capable, voice-interactive site built for one specific
5-year-old (大班/pre-K) working through a 大班 math textbook (the 配套教材) one lesson ("讲")
at a time. The child can't read yet, so every chapter is voice-first: instructions are spoken aloud
(DashScope TTS with a child-voice model, falling back to Web Speech API), and several chapters
let the child answer out loud via a browser mic + ASR; 第2讲 also lets the child hold a paper
model up to the webcam for a vision model to praise. It was built to run on the parent's own
machine and still does; since 2026-07 it *also* runs on an Aliyun ECS behind HTTPS — see
"Deployment" below. Since 2026-08 there *is* a minimal account system (phone + SMS login, no
password), gated by `AUTH_MODE` — off by default so local dev and offline use are untouched, on
for the public host. It exists to defend the DashScope bill and to carry each child's progress
across devices, **not** to grow into a multi-user product: still exactly one权限, invite-code
admission only, 1:1 account↔child. See "Account system" below. On a public host, that
single-user shape is a constraint to defend rather than a simplification to enjoy.

The whole site is **bilingual (中文 / English)** behind one 🇨🇳/🇬🇧 flag toggle — see
"Bilingual" below. Each chapter also ships a **家长伴读页** (`chapters/*/家长.html`): a plain,
readable page for the parent with the teaching outline, per-activity help, and the answers.
There is also one **site-level 使用指南** (`web/指南.html`, served at `/guide`, linked from a pill in
the home page's top-left corner) — Chinese-only, instruction-sheet shaped, answering *how the site
works and what to do when it breaks* rather than what a lesson teaches. Keep the two apart: 指南 =
operating problems, 家长 = teaching problems. Those adult pages are the one place in the repo where
normal prose on screen is fine — the child-UI rules below don't apply to them.

## Structure map

```
math_edu/
├── src/math_edu/        FastAPI app: chapter discovery/mounting, home page, /api/* voice routes
│   ├── app.py            app factory — reads chapters/, mounts /ch/<dir>/ and /shared/, wires
│   │                      the login wall + /login (AUTH_MODE=on only)
│   ├── settings.py       reads root .env, exposes model IDs, cache dir, chapters/shared dirs,
│   │                      AUTH_MODE + DB/session/aliyun creds (fail-fast if on & any missing)
│   ├── api/               health.py / tts.py / asr.py / judge.py / vision.py + auth.py (登录注册
│   │                      合一 API) / progress.py (不透明 jsonb 进度读写) — one router each
│   ├── db.py / models.py  账号体系数据层：惰性 engine（off 模式零连接）+ 五张表（users/
│   │                      invite_codes/progress/verify_sessions/sms_sends）
│   ├── auth_gate.py       登录墙中间件（未登录 页面302 / api401）+ current_user_id 单一真相源
│   ├── aliyun.py / verify_state.py / auth_service.py  阿里云验证码+短信客户端 / 验证态状态机+
│   │                      限频（Postgres 版）/ 用户·邀请码查询建号
│   └── services/          dashscope_client.py (API calls), tts_cache.py (disk cache)
├── chapters/             one subfolder per lesson, each self-contained + own manifest.json
│   ├── 02-cube-fold/      第2讲 拆装正方体 — 方方穿新衣: five activities, all on web/shared
│   └── 03-fangwei/        第3讲 空间方位大冒险 — 14 环节; 方位词.js holds its taught glyphs
│   （each chapter: 台词表.js = every spoken line, 两语同构; 家长.html = the parent's page）
├── web/指南.html         站级使用指南 — the adults' manual, served at /guide (中文, zero scripts)
├── web/登录.html         登录注册合一页 — served at /login (AUTH_MODE=on only; 成人页, 自包含,
│                          ct4.js from CDN); like 指南.html the child-UI rules don't apply here
├── web/shared/           cross-chapter frontend library, served at /shared/
│   ├── js/                 voice engine (说话/录音/问答/问答调度/判对/看见/罗盘/路网/音效/进度/搭台)
│   │                       + 云同步.js (每讲登记 {存储键,合并,收编}; 拉-合并-推; 失败静默休眠)
│   │                       + 舞台.js (基准舞台 + 缩放坐标换算) + 转屏.js (竖屏拦罩)
│   │                       + 语言.js (current language, subscriptions, `选({cn,en})`)
│   │                       + 语言开关.js (the 🇨🇳/🇬🇧 toggle itself — home page and both chapters)
│   │                       + 实体图.js (entity-art registry — see "实体图" below)
│   │                       + 预热.js (idle-time entity-art warmer — see "实体图" below)
│   │                       + 后退.js (browser-back = up one layer — see "Shared widgets" below)
│   ├── assets/实体图/       sticker-style entity art, 256px transparent WebP (q90), filename = 素材名
│   │                       (one deliberate non-square exception: 篮子 — see "实体图" below)
│   ├── css/                shared component styling (麦克风坞 / 语言开关 / 舞台 / 转屏 / 热区
│   │                       — hosts <link> them, shared sheets before their own)
│   ├── vendor/three/       vendored three.js (no CDN, must work offline)
│   └── test/                node --test: pure-logic modules (判对/语言/问答调度/看见/罗盘/路网/实体图
│                            /舞台 缩放算术/转屏 两语同构) + three repo-wide red lines
│                            (没有实体emoji / 样式表完好 / 舞台里没有视口单位 — 样式表完好 also
│                            reads the inline <style> of the adult pages, 家长.html + 指南.html)
├── var/cache/tts/        disk cache of synthesized mp3s (gitignored, keyed by model|voice|text)
├── data/                 scanned textbook PDFs — copyrighted, gitignored, never committed
├── docs/adr/             architecture decision records (e.g. why the fold engine is generic)
│   ├── ../课程设计约定.md      course-design norms for new chapters — deliberately light; see below
│   ├── ../部署到阿里云ECS.md   the ECS runbook: commands + the traps that first deploy hit
│   └── ../性能优化.md          the speedup work: diagnosis, four measures, measured before/after
└── .scratch/<slug>/issues/   ticket tracker — see "House style" below
```

`pyproject.toml` (uv-managed) and `package.json` (root, node test runner only — no node runtime
needed to serve the site) live at repo root alongside `.env` / `.env.example`.

## Common commands

```bash
uv sync                                             # install/refresh Python deps (uv.lock committed)
uv run uvicorn math_edu.app:app --port 8300         # start the whole site (also: .claude/launch.json → "math-edu")
npm test                                             # everything: chapters/*/test/*.test.js + web/shared/test/*.test.js
node --import ./tools/共享路径.mjs --test "chapters/02-cube-fold/test/*.test.js"  # one chapter standalone
node --test "web/shared/test/*.test.js"             # just the shared engine's tests standalone
```

`--import ./tools/共享路径.mjs` teaches `node --test` the one thing the web server knows and node
doesn't: `/shared/...` means `web/shared/...`. Chapter code imports the shared engine and vendored
three.js by the absolute path the browser uses, so any test that loads a chapter module needs the
hook — `npm test` already bakes it in. Shared modules import each other relatively, so the
`web/shared/test/*` run doesn't need it.

The app serves `/` (chapter picker), `/guide` (the adults' manual), `/ch/<chapter-dir>/` (each
lesson), `/shared/` (shared JS, CSS + vendored three.js), and `/api/health`, `/api/tts`,
`/api/asr`, `/api/judge`, `/api/vision`.

`/guide` is the one route that renders a *file* rather than a string template: `web/指南.html` is
hand-written and self-contained, and the server only swaps its `<!--家长页-->` anchor for the list of
chapters that have a 家长.html — the same trick and the same "存在才显示" check as the home page's
`<!--卡片-->`. That's deliberate: the footer links can't rot when a 第4讲 lands, so no test has to
guard them. Structure beats a red line whenever you can get it.

**Shared widgets live in `web/shared/`, markup and all — never a per-chapter copy.** Five exist:

- **The mic dock.** Markup from `问答.js`, styling from `/shared/css/麦克风坞.css` (hosts `<link>`
  it *before* their own sheet, then re-colour via `--坞按钮亮/暗/影`, `--坞纸`, `--坞软影`).
  At runtime there is exactly one on the page — activities take turns via `借麦克风()`
  (see `问答调度.js`).
- **The 🇨🇳/🇬🇧 toggle.** `装语言开关(挂点, {onSwitch, 点一下})` from `/shared/js/语言开关.js`,
  styling from `/shared/css/语言开关.css` (re-colour via `--旗底`, `--旗影`, `--旗选中底`,
  `--旗号`; the host owns `position`). Selected state is **`aria-pressed` only** — one source of
  truth, no companion `.选中` class.
- **Browser-back integration.** `装后退({起点, 切到})` from `/shared/js/后退.js` turns the back
  gesture into "up one layer" (activity → level map → site index) by pushing one history entry
  per layer. The one rule: **the only way to leave a layer is `退()`** — programmatic returns
  (导读's auto-return) included; switching panels directly leaves an orphaned entry that
  teleports the child back into a level they already left. 🏡 = up one layer, both chapters.
- **The 基准舞台.** `装舞台(外壳, {宽, 高})` from `/shared/js/舞台.js`, styling from
  `/shared/css/舞台.css`. A chapter's geometry is drawn at one constant logical resolution and the
  whole thing is uniformly `transform: scale()`d to fit any screen — see "触屏与基准舞台" below.
  The same file owns the coordinate arithmetic (`舞台系数()`, `框心到舞台()`) and the *only* copy of
  the touch hygiene (`touch-action: none`, `overscroll-behavior`, `-webkit-touch-callout`) — don't
  restate those per chapter.
- **The 转屏拦罩.** `装转屏拦罩()` from `/shared/js/转屏.js`, styling from `/shared/css/转屏.css`.
  Portrait + coarse pointer ⇒ cover the lesson with a graphics-only "turn the phone" animation and
  speak one line; landscape ⇒ get out of the way and the child resumes exactly where they were
  (panels were never unmounted). Lessons only — the adult pages read fine in portrait and must not
  mount it.

The first two were per-chapter copies once, and **both drifted the same way**: different class names,
different labels, different notions of "selected". The dock's copies also caused a *silent*
runtime failure — whoever grabbed it last stranded the previous holder's `await` forever.
If you catch yourself hand-rolling a widget a second chapter will want, put it here first.

## 实体图

Entity emoji (animals/foods/landmarks the child must recognize or name) are being replaced by
**pre-generated sticker-style art** — 85 assets, both chapters, **done**. See `docs/adr/0003`
and `CONTEXT.md` for the vocabulary; the工程 tickets are in `.scratch/entity-art/issues/`.

- **Scope**: every 实体 the child sees — 教学实体, 提示实体, and 布景/道具 alike. Only **UI 图形**
  stay emoji (🎤🔊▶🇨🇳✅❌⭐🏆 confetti, direction arrows, manifest icons): they carry an
  *operating convention*, not a thing from the lesson. That boundary is now a **red test**
  (`web/shared/test/没有实体emoji.test.js`) with a whitelist that demands a written reason per
  character — so nobody has to remember the rule, and nobody can quietly regress it.
  Three things are deliberately CSS, not art *or* emoji: 拍照's four colour dots (the colour
  *is* the answer), 宝藏's footprints (directional footprints are exactly what image models get
  wrong), and Boss's compass needle (its old glyph 🡱 sits in a rare Unicode block most system
  fonts don't cover — the circle rendered empty).
- **Two kinds of name, don't mix them**: 规范名 is 判对's key (never changes); **素材名** is the
  key of a *visual* entity and the WebP's filename. 规范名 → 素材名 is **many-to-one** — 小狐狸 and
  狐狸 share one drawing, because the child must not meet two different foxes. The 归一表 lives in
  `实体图.js`. Counter-example worth keeping: 小鸡 and 大公鸡 look alike but are two entities.
- **Pipeline (dev-time only, never at runtime)**: `tools/生成实体图.py` (百炼 qwen-image-2.0,
  prompt template pins the sticker style, seed fixed, one description table for all entities) →
  `tools/抠白底.py` (flood-fill matting, crop, 256px, save as WebP q90) → commit WebP under
  `web/shared/assets/实体图/<素材名>.webp`. Raw 2048px outputs in `.scratch/entity-art/` are
  gitignored PNG (intermediate stays lossless; only the shipped 256px asset is WebP). Animals drift the most —出 2–3 张校样比对再放量 (the squirrel came back as a shaded
  illustration on the first pass; the prompt now pins 严格平涂).
  One deliberate exception to the square: **篮子** (第4讲蘑菇站) ships ~1024×623 via
  `tools/裁篮子.py` — the model insists on a tall handle, so the script crops it off and keeps the
  basket's **敞口** (rim + cavity + front wall) so the picked mushrooms nestle *inside* the opening;
  that script's header carries the why (and why the earlier front-wall-only crop read as "遮挡"), and
  the host CSS sizes it by its real aspect ratio instead of 画实体's square 尺寸 parameter.
- **Rendering has exactly one gate**: `画实体(名, 兜底emoji, {类名})` for HTML, `画实体SVG(…)` for
  the SVG level map — both decide via the same `画法()`. Chapter data keeps its emoji field as the
  runtime fallback (a missing image never breaks the child's session), but that fallback must go
  *through* the gate; assigning an entity emoji straight to `textContent` is the red test above.
  Size the image to the emoji's old font-size box — swapping art must not move anything.
- **Coverage is one seam**: every 环节 exports `实体们` (its entities' 规范名; genuinely empty ones
  export `[]` so "none" and "forgot" stay distinguishable), and one per-chapter test walks every
  module and reconciles 实体们 ⊆ registry ⊆ disk. 第 2 讲's roster hangs off its palette instead.
- **Preheating rides that same seam.** Each chapter calls `预热实体图(取名单)` (`预热.js`) once at
  boot; the supplier aggregates the chapter's `实体们` (第 3 讲 imports its 环节 modules, 第 2 讲
  hands over the palette roster), so a new 环节 that exports `实体们` is preheated for free. The
  list arithmetic is `图清单()` in `实体图.js` — pure, tested, dedupes through the 归一表 and drops
  entities without art. The executor is deliberately meek: idle-start (`requestIdleCallback`),
  concurrency ≤4, every failure silent — a dead preheat means the child sees on-demand loading,
  never a broken lesson. It takes URLs from the rendering gate, so it is format-blind by design.
- **Never key anything on the emoji character.** 宝藏's 💰/💎/👑 and Boss's 🐲→💨 used to; both are
  now named keys. On the 3D side (第 2 讲), all canvas textures go through one async-asset
  primitive (`src/render/贴纸贴图.js` — one implementation per 讲, its header explains the
  三态) — canvas shows plain colour until the WebP lands, never a blank face.

## Bilingual

One 🇨🇳/🇬🇧 **graphic** toggle (the child can't read) on the home page and inside each chapter.
Single click, no confirm — switching is reversible and touches no progress, unlike 「重来」.
Choice lives in `localStorage` under `站点:语言` (`cn`|`en`), site-wide.

- **It's a parallel English course, not English narration of a Chinese one.** In EN mode the
  taught glyphs themselves become the English words (东南西北 → NORTH/SOUTH/EAST/WEST).
- **In-chapter switching is live.** `说话.js` subscribes to the language itself and, because it
  is imported before any panel, sits first in the subscriber queue — so 停语音 → 面板重绘 →
  新语言重读 happens for free. **Chapter code never has to sequence this.**
- **Lines live in two isomorphic tables** per chapter (`台词表.js`), plus the shared feedback
  三摊 in `问答.js`. Missing a translation is a *red test*, not a Chinese sentence in the child's
  ear — every 台词表 test asserts key-set equality and "no Han characters in the English table".
  Read from the table at *speak time*: `const {问句} = 台词.猜一猜` welds Chinese in at import.
- **Judging is language-blind.** 判对's canonical names are **always Chinese**; English is just
  extra 说法 on each entry, and the accept set is always the union — saying `east` or「东边」
  both count in either mode. Only the *feedback* follows the current mode. Don't "fix" this by
  translating 罗盘's or 判对's keys; English lives only in the display and speech layers.
- **One voice, two languages.** `longjielidou_v3.6` (龙杰力豆, the 5-year-old boy voice) is
  官方标注 bilingual, so `TTS_VOICE_EN` defaults to empty → falls back to `TTS_VOICE`. `/api/tts`
  takes an optional `lang`; an explicit `voice=` always wins (试音页 depends on that).
  `fun-asr-flash` auto-detects language, so ASR needs no language parameter at all.
- **Preheating is `说话.js`'s job alone.** Chapters hand it a *supplier* —
  `备话((语) => 全部台词({语, …}))` — and it does the rest: one line at a time, 700 ms apart
  (the backend synthesizes one at a time), **yielding whenever the mouth is busy**, deduped per
  `语言|音色|文本`, and re-run with the new language on every switch. A chapter's 台词表 only
  answers "which lines, in what order" (opening line and activity names first). Don't rebuild
  the batching per chapter — both chapters used to, and it bought nothing.
- English words are longer than the Chinese they replace. Chapters carry a
  `:root[data-语="en"]` block for font-size relief — **positions stay put**, only the glyphs
  differ. Watch for things sized to fit exactly one Han character.

## House style

- **Language split is deliberate, don't "fix" it**: frontend chapter/shared JS uses Chinese
  identifiers (`说()`, `判对`, `进度`, `罗盘`...) — that *is* the naming convention, matching the
  textbook's own vocabulary. The Python backend (`src/math_edu/`) uses normal idiomatic
  snake_case. Never convert one to match the other.
- **`AGENTS.md` files are thin pointers, this file is the source.** Root + `web/shared/` +
  each chapter + `src/math_edu/` carry one for agents that look for that name; each holds only
  directory-local rules and links here. Never let one grow a second copy of anything written
  here — copies drift (see "Shared widgets" above).
- **Issue tracking**: tickets live in `.scratch/<slug>/issues/NN-title.md`, each with a `Status:`
  line (`ready-for-agent`, `on-hold`, etc.); specs for a whole chapter also live there (e.g.
  `.scratch/fangwei/issues/00-spec.md`). Architecture decisions go in `docs/adr/` instead.
- **One deliberate testing seam**: pure-logic, no-DOM/no-network modules (judging, compass math,
  road-graph, fold-engine helpers...) get `node --test` coverage — shared engine tests live in
  `web/shared/test/`, chapter-specific logic tests live in that chapter's own `test/`. Everything
  UI-shaped is verified by hand in a browser, not automated. The FastAPI `/api/*` endpoints are
  thin proxies to DashScope; they're verified with curl during development against a real key,
  not mocked in CI.
- **Child-UI constraints** (fullest write-up: `chapters/02-cube-fold/CONTEXT.md`, echoed in the
  fangwei spec) apply to every chapter: the child can't read, so no sentences on screen — every
  instruction is spoken, with the sole exception of the specific characters being taught that
  lesson (e.g. 东南西北). **Pointer-first: mouse and touch are both first-class** — see
  "触屏与基准舞台" below (this used to read "mouse + hover only, no touch"; it was overturned in
  `docs/adr/0004` when the lessons had to work on the parent's iPhone). Progress is versioned JSON in
  localStorage; a version mismatch is treated as "no progress," and a failed write must never
  throw — the child keeps playing even if nothing saves. Panels within a chapter stay mounted and
  swap via `visibility` + `inert`, never `display:none`/unmount, so 3D scenes don't get rebuilt
  and in-progress state survives switching activities. "Reset" always asks-then-confirms (two
  distinct clicks) since a misclick shouldn't nuke progress.

## 触屏与基准舞台

The lessons run on the parent's iPhone as well as the desktop. Touch is a first-class input, not a
retrofit. Four rules; the reasoning and the rejected alternatives are in `docs/adr/0004`.

- **Draw at one constant resolution.** A chapter's geometry lives on a fixed-size **基准舞台**
  (`装舞台`), uniformly scaled to whatever screen it lands on. There is exactly **one** layout, not
  a desktop one and a phone one — 14 环节 × two layouts is how the shared widgets drifted twice.
  A new 环节 inherits phone support by being drawn on the stage; no media queries per activity.
- **Mind which coordinate system you're in.** `left/top` are **舞台坐标** (pre-scale); pointer
  events and `getBoundingClientRect()` report **视觉坐标** (post-scale). Feeding one into the other
  doesn't throw — it just means the child's taps land somewhere else. Convert via `舞台系数()` /
  `框心到舞台()`. Canvas backing stores must be sized by `devicePixelRatio * 舞台系数()`.
- **No viewport units inside the stage** — `vw`/`vh`/`dvh`/`svh`/`vmin`/`vmax` resolve against the
  real viewport no matter what transform an ancestor carries. So `min(600px, 70vh)` on a stage
  element computes 70% of the *phone's* ~358pt inside an 842-tall stage: everything around it
  scales, that one thing doesn't, and the layout **distorts** rather than shrinking. Desktop hides
  it completely. Use px, or `%` of a stage-sized parent. Legitimate uses are all *outside* the
  stage (`html`/`body` height, 开始遮罩, 转屏拦罩, the 纸样 print flow, which needs real
  millimetres). This one **is** automated — `web/shared/test/舞台里没有视口单位.test.js`, with a
  whitelist that demands a written reason and fails on stale entries too.
- **Child touch targets must render ≥44pt on the smallest phone — the pixel count is derived,
  never assumed.** `required stage px = 44 / 系数`, where `系数 = usable height / 基准高`. Worst
  case is an iPhone 17 Pro in landscape (874×402pt, ~358pt usable after the toolbar). 第3讲's
  baseline measures **842** tall (系数 ≈0.425 ⇒ floor **104**); 第2讲's is **740** (≈0.484 ⇒ **92**).
  **Each chapter derives its own** and writes the arithmetic in its stylesheet header — the two
  differ, so never copy a pixel count from the other chapter. An earlier draft of this rule said a flat
  "≥80px" — that was 44pt over a guessed 0.63 scale, and measurement killed it. Measure content →
  set the baseline → derive the floor, in that order.
  Two routes, chosen by **who the neighbour is**: `热区` / `热区不动位` compensates for the scale
  and always adds ~20pt, so ≥55 stage px suffices — but only for isolated controls. Where the
  neighbour is *another answer* (a row of answer tiles, the dock's fallback answers), the target
  must really be enlarged: an invisible expansion overlaps the neighbour, and a stolen tap there
  submits the wrong answer rather than the wrong screen.
  **Deliberately-small adult controls (重来, 家长钮) are exempt** — small is their anti-misclick
  feature, not a bug. This one isn't automated: judging which selector is a child target isn't
  something a test can do honestly, so it's a review rule, like everything else UI-shaped here.
- **Hover is decoration, never the only signal.** Wrap decorative `:hover` in
  `@media (hover: hover)` or a tapped control stays stuck looking pressed. Where hover carried real
  information, the touch equivalent must be *positive*, not absent: 第2讲's foldable faces used only
  a cursor change, and now breathe on coarse pointers (same `可折` truth, no second state).
- **Lessons are landscape-only on phones** (`装转屏拦罩`); portrait is 0.31× — unreachable, not
  cramped. The adult pages (家长, 指南, home, 试音) must stay readable in portrait *and* landscape,
  and must not mount the gate.

## How to add a new chapter

0. Read `docs/课程设计约定.md` first — the *course-design* layer (art direction, pacing,
   feedback ritual, what's deliberately left free). It is intentionally light; this section
   covers only the engineering steps and repeats none of it.
1. Create `chapters/NN-slug/` with an `index.html` entry point (self-contained; relative paths
   inside the folder work as-is once mounted at `/ch/NN-slug/`).
2. Add `manifest.json` in that folder — parsed by `_load_manifest()` in `src/math_edu/app.py`:
   ```json
   { "title": "...", "subtitle": "...", "icon": "🔷" }
   ```
   All fields are optional with fallbacks (`title` → directory name, `icon` → 📘). `entry` is
   accepted but not currently wired to anything — `StaticFiles(html=True)` always serves
   `index.html`, so don't rely on `entry` to point elsewhere yet.
3. Pull in the shared voice engine with absolute imports, e.g.
   `import { 说 } from '/shared/js/说话.js'`. Shared modules themselves use relative imports
   between each other (that's what lets `node --test` run them directly, no bundler).
   `<link>` the shared widget sheets (`麦克风坞.css`, `语言开关.css`, `舞台.css`, `转屏.css`,
   `热区.css`) *before* your own, mount the toggle with `装语言开关()`, and write the lesson's lines
   as two isomorphic tables from the start — see "Bilingual". Retrofitting a chapter to two languages
   costs far more than starting with the second table present but sparse.
   Draw the whole lesson on a 基准舞台 (`装舞台(外壳, {宽, 高})`, one named constant per chapter) and
   mount `装转屏拦罩()` — do both on day one for the same reason as the second line table: a chapter
   written against the viewport is far more expensive to move onto the stage than one born on it.
   Keep the page background on `body`, not on the stage, or the letterbox shows a seam.
   Have every 环节 export `实体们` and call `预热实体图()` once at boot (see "实体图") — the
   coverage test and the preheater both feed off that one export.
4. Put chapter-specific pure-logic tests in `chapters/NN-slug/test/*.test.js`; they're picked up
   automatically by the root `npm test` glob — no config changes needed.
   Also add `title_en` / `subtitle_en` to the manifest (the home page falls back to the Chinese
   title without them), and a `家长.html` — the home page grows its 家长 badge for any chapter
   that has one, automatically.
5. **Zero backend code should change.** `_discover_chapters()` scans `chapters/` on startup and
   mounts whatever it finds — that's the whole point of ticket 02's generic mounting mechanism.
   If you find yourself editing `app.py` to add a chapter, something's wrong.
   The account system keeps this promise too (see below): a new chapter's progress is one more
   `progress` row keyed by its localStorage key — no table, no backend edit. To get cloud sync,
   the chapter exports a `合并(本地, 云端)` pure function and calls `登记`+`启动同步` at boot.

## Account system

Since 2026-08. Full spec + tickets in `.scratch/accounts/`; design was pinned in a grilling and
every decision is deliberate. The whole thing is **dormant unless `AUTH_MODE=on`** — local dev and
offline use never connect to a DB or touch Aliyun, and behave byte-for-byte as they did before.

- **One gate, `AUTH_MODE`** (mirrors `CACHE_PROFILE`): off (default) = zero auth footprint; on =
  whole-site login wall + DB + Aliyun. On + any required credential missing ⇒ **startup raises**
  (a half-up login wall locks everyone out *without* erroring — the worst failure shape). The
  cookie flavor is keyed off `CACHE_PROFILE` (`public` ⇒ `__Host-` + Secure; else plain, so local
  on-mode over http still works).
- **Admission is invite-code only; login is phone + SMS, no password.** No password means no reset
  flow, no change-password page, no bcrypt — a whole slab of code that doesn't exist. Login and
  register are **one page/one flow** (`/login`): old phone → session; new phone → needs a valid
  one-time invite code → creates the user. **SMS isn't sent until eligibility is checked** (known
  user *or* valid invite) — a stranger can't even burn an SMS. Generate codes with
  `tools/生成邀请码.py` (already ran once, 10 codes in the DB).
- **1:1 account↔child, no child table.** Two-kid family = two phone numbers. Deliberate; revisit
  only if a real need appears.
- **Progress is opaque `jsonb`, whole-package.** The backend never interprets a payload — it's the
  chapter's localStorage value verbatim, keyed by the localStorage key. Version migration, data
  washing, and **merge** all stay in each chapter's frontend (where the existing, tested code is).
  `PUT /api/progress/{key:path}` upserts (64KB cap → 413); `GET /api/progress` returns the whole
  user's progress in one shot.
- **Sync = per-chapter `合并(本地, 云端)` + a shared engine (`云同步.js`).** Merge is a pure
  function (node --test'd, like 判对/罗盘): stars/图鉴 union (only grow), answers conflict → local
  wins, and a **reset stamp** (per-partition or whole-package) makes 重来 propagate instead of a
  stale device resurrecting cleared stars. The engine does boot-pull→merge→push, refetch on tab
  refocus, debounced push on change, `sendBeacon` on pagehide — and **sleeps silently** on off /
  unauth / offline, so a sync failure never interrupts the child. Three hard constraints for
  chapters live in `云同步.js`'s header (记脏 after localStorage write & synchronous; 收编
  synchronous; 重来 = write stamped-empty then 立即推).
- **Verify state lives in Postgres** (`verify_sessions` + `sms_sends`), not Redis: rate limits
  (1/min·5/hr·10/day, ≤5 SMS per captcha) survive restarts and every send leaves an audit row.
  Aliyun captcha stays **fail-closed** (network error ⇒ not verified). Phone numbers are masked in
  logs.

## Deployment

Since 2026-07 the site also runs on an Aliyun ECS at **https://math.chongliangmango.com**,
alongside an unrelated app (`deposit-monitor`, gunicorn on :8000, serving `www` + apex). Nothing
about the local `uv run uvicorn` workflow changed — the deployment is a second copy of the same
repo, no build step, no deploy script.

**The runbook — every command, plus the eight traps the first deploy hit — is
`docs/部署到阿里云ECS.md`. Keep it there, not here.** What follows is only what a reader of this
file needs to avoid breaking the deployment from the code side.

- **Repo at `/home/admin/Projects/math_edu`; `math-edu.service` runs uvicorn on :8300.** The unit
  is `Type=simple` with `ProtectSystem=strict` + `ReadWritePaths=<repo>/var` — so `var/cache/tts`
  must exist *before* first start, because `settings.py` mkdir's it at import time and the repo
  root itself is read-only under that sandbox.
- **nginx terminates TLS and reverse-proxies to :8300**, config confined to its own
  `/etc/nginx/conf.d/math-edu.conf`. Cert is Let's Encrypt ECC via acme.sh (webroot
  `/var/www/acme`), renewing itself — the `/.well-known/acme-challenge/` location in the :80
  block is load-bearing, deleting it breaks renewal 60 days later, silently until it doesn't.
  That same config owns gzip (`gzip_proxied any` is load-bearing too — everything here goes
  through `proxy_pass`, and nginx won't compress proxied responses without it).
- **Cache-Control is profile-switched, not hardcoded.** The `apply_cache_profile` middleware
  (`app.py`) reads `CACHE_PROFILE` from `.env`: `dev` (the default) stamps `no-cache` on all
  statics so an edited lesson is never silently the old one; `public` serves SWR tiers (entity
  art + vendored three: a day hard + a month SWR; code: `max-age=0` + a week SWR, so a deploy
  lands on the next open). **The ECS `.env` must say `CACHE_PROFILE=public`** — without it the
  public site regresses to a 304 round-trip per file per open, the exact slowness the speedup
  work measured and killed. `/api/tts`'s own one-year header always wins (`setdefault`).
  Diagnosis, numbers, and the why: `docs/性能优化.md`; verification curls: the runbook.
- **It's a subdomain, not `www.../math`, and that is forced by this repo's own conventions.**
  The frontend hardcodes three *root* paths — `/shared/`, `/ch/`, `/api/` — across ~60 files
  (`import … from '/shared/js/…'`), and that absoluteness is deliberate: `tools/共享路径.mjs`
  maps `/shared/...` → `web/shared/...` so `node --test` can load chapter modules unbundled.
  Serving under a path prefix would mean rewriting all of it, or letting this site squat three
  root paths on a domain another app already owns. If a future request is "mount it under some
  path", the answer is another subdomain.
- **HTTPS is not decoration.** `getUserMedia` (`录音.js`, `看见.js`) only works in a secure
  context, so over plain http (or a bare IP) the mic and webcam activities fail *silently* while
  the rest of the site looks fine.
- **What guards the public host is the account system's login wall (`AUTH_MODE=on`), not nginx
  Basic Auth.** Basic Auth was the first-deploy stopgap (2026-07); it was retired on 2026-08-03
  after a real-phone login was verified end-to-end (see "Account system" and the runbook's
  cutover section).
  Either way the invariant is the same: without a gate, anyone who finds the domain can drive
  `/api/tts` and spend the DashScope key. The login wall whitelists only `/login`, `/api/auth/*`,
  `/api/health`, and `/favicon.ico` (the browser requests it on its own — blocking it just spams
  401s on the login page); **if a future change makes some path public, keep `/api/*` behind the wall.**

## Key & model configuration

- `.env` lives at repo root, is gitignored, and is read once at process start
  (`src/math_edu/settings.py`); `.env.example` documents the shape and current defaults. A
  placeholder key (non-ASCII, e.g. `sk-你的key填这里`) is treated as "not configured" — `/api/tts`
  then returns 503 and the frontend falls back to Web Speech API.
- Model IDs (`TTS_MODEL`, `TTS_VOICE`, `ASR_MODEL`, `JUDGE_MODEL`, `VISION_MODEL`) are all
  env-configurable — changing a model is a `.env` edit, never a code change.
- **The Aliyun Bailian (百炼) model market churns.** Models get flagged "即将下线" and pulled on a
  roughly six-month cadence — several were already retired before this restructure (qwen3-asr,
  qwen3-tts, old cosyvoice, qwen-omni-turbo). Before changing any model ID, check the model market
  for retirement flags yourself; don't assume a previous session's choice is still current.
