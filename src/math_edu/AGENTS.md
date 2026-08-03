# AGENTS.md — src/math_edu/（FastAPI backend）

Read the root [CLAUDE.md](../../CLAUDE.md) first. Rules specific to this directory:

- **Idiomatic snake_case Python here** — the Chinese-identifier convention is frontend-only.
- **Adding a chapter must not touch this directory.** `_discover_chapters()` mounts whatever
  `chapters/` holds; the home template's per-chapter bits (家长 badge, `title_en`) read the
  manifest and the chapter folder, never a hardcoded list.
- Endpoints are thin DashScope proxies, verified with curl against a real key — no mocked API
  tests. Every failure path must degrade, not break: bad/missing key → 503 so the frontend
  falls back to Web Speech.
- Model IDs and voices come from `.env` only (see `settings.py` / `.env.example`); changing a
  model is never a code change. Before adopting any new 百炼 model ID, check the model market
  for 「即将下线」 flags yourself.
- Cache-Control is stamped in one place — the `apply_cache_profile` middleware in `app.py`,
  switched by `CACHE_PROFILE` (see CLAUDE.md "Deployment"). Endpoints don't set cache headers,
  with one deliberate exception: `tts.py`'s one-year header, which wins via `setdefault`.
- `tts_cache.py` holds a lock because dashscope's WebSocket client breaks under concurrency
  (six parallel calls → three 502s, measured). Don't "optimize" the serialization away.
  Cache key is `model|voice|text`; `lang` never enters the key — the text itself differs.
- The home page in `app.py` is the one server-rendered page; its inline script consumes
  `/shared/js/语言.js` + `语言开关.js` like the chapters do. Widget styling belongs in
  `web/shared/css/`, not in this template.
