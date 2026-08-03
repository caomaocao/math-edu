# AGENTS.md — chapters/02-cube-fold（第2讲 拆装正方体 · 方方穿新衣）

Read the root [CLAUDE.md](../../CLAUDE.md) first, then **[CONTEXT.md](CONTEXT.md)** — the
chapter glossary (方方/衣服/格子/对面…) and the fullest statement of the child-UI rules.
Design decisions: `.scratch/cube-v2/issues/00-spec.md`; fold-engine rationale: `docs/adr/`.

Chapter-local rules:

- **Every spoken line lives in `src/data/台词表.js`** — two isomorphic tables (cn/en), UI picks
  at speak time (`台词()` is a *function*; destructuring a table at import welds one language
  in). `lines.test.js` reds on any missing translation. Answers are never hardcoded — folds are
  computed by `domain/net.js` (ADR-0001).
- `家长.html` is the parent companion page: plain prose allowed, zero `<script>`, zero textbook
  excerpts. Its answer section is dead HTML transcribed from the question banks — if you change
  `src/data/bookQuestions.js` / `fruitQuestions.js`, update it (both files' headers remind you).
- Run this chapter's tests standalone:
  `node --import ./tools/共享路径.mjs --test "chapters/02-cube-fold/test/*.test.js"`
- Panels never unmount; the three.js stage is built exactly once. `guessVoice.js` deliberately
  does **not** use 洗转写() — the English filler list would eat yes/no answers; see its header.
