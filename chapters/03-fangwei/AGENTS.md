# AGENTS.md — chapters/03-fangwei（第3讲 空间方位大冒险）

Read the root [CLAUDE.md](../../CLAUDE.md) first; the child-UI rules are written up fully in
`chapters/02-cube-fold/CONTEXT.md` and apply here too. Design decisions:
`.scratch/fangwei/issues/00-spec.md` (original) and `.scratch/bilingual/issues/` (双语).

Chapter-local rules:

- **Three single-source files** — never write these inline in an 环节 module:
  - `js/台词表.js` — every spoken line, two isomorphic tables; 模板 args take Chinese canonical
    方位名, but data names (animals/foods/places) arrive already language-picked, English as
    bare nouns.
  - `js/环节表.js` — the 14 stage names (the map speaks them on hover), bilingual.
  - `js/方位词.js` — taught glyphs: `方位牌` (printed, EN uppercase) vs `方位说` (spoken, EN
    lowercase — the TTS cache keys on the exact string). 罗盘.js's math and Chinese keys are
    off-limits.
- 环节 modules are lazy-loaded on first entry (`主.js` 打开()); panels stay mounted afterwards.
  Each module's `换语言()` mutates the *live* DOM; a mid-level language switch re-issues the
  current level (in-level dots reset, localStorage stars untouched — deliberate, see ticket 06).
- English mode layout relief goes under `:root[data-语='en']` in `styles.css` — adjust glyph
  sizing only, never positions.
- Standalone tests:
  `node --import ./tools/共享路径.mjs --test "chapters/03-fangwei/test/*.test.js"`
- `家长.html`: same red lines as 第2讲's (zero script, zero textbook content); its answers were
  hand-derived from the stage data — keep them in sync when changing 题库.
