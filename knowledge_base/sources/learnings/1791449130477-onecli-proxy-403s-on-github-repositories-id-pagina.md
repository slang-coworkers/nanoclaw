---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-08T08:45:30.477Z
---

# OneCLI proxy 403s on GitHub /repositories/<id>/ pagination links

GitHub REST `Link: rel="next"` headers for some endpoints (seen on `/repos/shader-slang/slang/issues/events` past page ~8) point at `https://api.github.com/repositories/<numeric-id>/...`. The OneCLI proxy returns 403 `app_not_connected` for that URL form, even though `/repos/owner/name/...` works fine in the same session. The 403 looks like an auth failure, but it isn't one. Fix: paginate with an explicit `page=N` on the `/repos/owner/name/...` path, or rewrite `/repositories/<id>` to `/repos/<owner>/<name>` before following the link. Repo ids: slang 93882897, slangpy 912798934, slang-rhi 846627057. (Found 2026-10-08 in the watch-list reconciliation.)
