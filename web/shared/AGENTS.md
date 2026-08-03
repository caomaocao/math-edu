# AGENTS.md — web/shared/

Read the root [CLAUDE.md](../../CLAUDE.md) first. Rules specific to this directory:

- **Everything in `js/` that is pure logic (no DOM, no network) must stay importable by bare
  `node --test`** — that's why shared modules import each other with *relative* paths, while
  chapters import them by the absolute `/shared/...` URL. Don't flip either convention.
- Tests live in `test/`, one file per module — plus **three** repo-wide red lines that sweep every
  chapter (`没有实体emoji` / `样式表完好` / `舞台里没有视口单位`) — run with
  `node --test "web/shared/test/*.test.js"`.
  Modules that touch network/Audio (`说话.js`, `录音.js`, `问答.js` runtime) are deliberately
  *not* unit-tested — browser-verified instead. Don't add mock-heavy tests to "cover" them.
- **Shared widgets own their markup here** (mic dock in `问答.js`, 🇨🇳/🇬🇧 toggle in
  `语言开关.js`) with a self-contained stylesheet in `css/` exposing `--变量` hooks. A widget's
  CSS must never reference a host chapter's private variables or keyframes — that failure is
  silent and chapter-specific. `后退.js` (browser-back = up one layer) is the third shared
  widget — markup-less, but its invariant (leave a layer only via `退()`) is in CLAUDE.md's
  "Shared widgets" section, along with the two newest: `舞台.js` (基准舞台) and `转屏.js`.
- **`舞台.js` is where the touch hygiene lives** — `touch-action`, `overscroll-behavior`,
  `-webkit-touch-callout` are declared once in `css/舞台.css` for the whole stage. A chapter
  restating them is a copy that will drift; a chapter *overriding* one needs a comment saying why.
- **Two coordinate systems, one converter.** Anything here that reads a pointer event or a
  `getBoundingClientRect()` and writes an element's `left/top` must go through `舞台系数()` /
  `框心到舞台()` from `舞台.js`. Getting it wrong doesn't throw — the child's taps just land
  elsewhere, which is why the arithmetic (not the DOM plumbing) is what `test/舞台.test.js` pins.
- Sequencing invariant: `说话.js` is imported before any panel, so its language subscription
  runs first (stop speech → panels redraw → re-read instruction). Nothing may depend on being
  earlier than it.
- `预热.js` warms entity art in idle time and must stay meek: idle-start, small concurrency,
  failures silent. Its pure half is `图清单()` in `实体图.js` (tested); the `Image()` half is
  deliberately not unit-tested — same rule as `说话.js`. Details: CLAUDE.md "实体图".
- 判对's canonical names are **always Chinese**; English lives only in per-entry 说法 and the
  display/speech layers. The accept set is always the two-language union.
