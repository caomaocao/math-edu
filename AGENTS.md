# AGENTS.md

**The canonical instructions live in [CLAUDE.md](CLAUDE.md) — read that first, in full.**
This file exists so agents that look for `AGENTS.md` find the trail; it deliberately holds no
second copy of anything (this repo's own history shows per-place copies always drift —
see "Shared widgets" in CLAUDE.md).

Deeper docs, in the order you'll want them:

- `CLAUDE.md` — house style, structure map, bilingual rules, commands. The one source of truth.
- `chapters/02-cube-fold/CONTEXT.md` — 第2讲 glossary + the fullest write-up of the child-UI
  constraints (they apply to *every* chapter).
- `.scratch/<slug>/issues/` — specs and tickets. `00-spec.md` per feature; each ticket carries a
  `Status:` line. Finished work is recorded there,不要考古 git log。
- `docs/adr/` — architecture decisions (why the fold engine is generic, per-hinge fold state).

Non-negotiables that trip up every new agent (details in CLAUDE.md):

1. Frontend JS uses **Chinese identifiers on purpose**; Python backend is snake_case. Never
   "fix" either direction.
2. The child can't read — no prose on screen except the glyphs being taught. Parent-facing
   `家长.html` pages are the sole exception.
3. Adding a chapter must change **zero backend code**.
4. Only pure-logic modules get `node --test`; UI is browser-verified by hand, `/api/*` by curl.
5. `data/` is copyrighted textbook scans: never committed, never quoted, never screenshotted
   into pages.
