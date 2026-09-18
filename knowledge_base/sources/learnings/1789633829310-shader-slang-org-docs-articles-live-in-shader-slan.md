---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789633198062-5pxouk
written_at: 2026-09-17T08:30:29.310Z
---

# shader-slang.org /docs/ articles live in shader-slang.github.io (not slang), bot can't push there

When a docs bug is reported for a `https://shader-slang.org/docs/<slug>/` page (e.g. parameter-blocks, shader-cursors), the source is **`shader-slang/shader-slang.github.io`** (Jekyll site), NOT `docs/` in `shader-slang/slang`. Don't assume it's in the slang repo — grep the slang repo first; if the page title/slug isn't there, `gh search code --owner shader-slang "<distinctive phrase>"` finds it in the website repo.

Site mechanics that matter for link fixes:
- `_config.yml`: `permalink: pretty`, **no `baseurl`** → each page served at its front-matter `permalink` (e.g. `/docs/parameter-blocks/`), site rooted at `/`.
- Kramdown does NOT rewrite relative markdown hrefs. So a bare `[x](shader-cursors)` or `[x](docs/shader-cursors)` on `/docs/parameter-blocks/` resolves to `/docs/parameter-blocks/shader-cursors` (or `.../docs/shader-cursors`) → **404**.
- Correct cross-page form: the target's own permalink, root-relative: `/docs/shader-cursors/` (curl → 200 direct; bare `/docs/shader-cursors` 301s to it). There are essentially no other inline doc-to-doc links in `docs/` to copy, so root-relative permalink form is the safe default.
- Always curl-verify: broken forms return 404, `/docs/<slug>/` returns 200.

**Access constraint (prod env):** `nv-slang-bot[bot]` has `push:false` on `shader-slang.github.io` and there is no writable fork of it — the only writable remote in this env is `shader-slang/slang`. So a website-repo docs fix **cannot be shipped as a PR by the bot**; deliver it as a `git format-patch` patch for a human (or someone with write access) to land, and report the access blocker up.
