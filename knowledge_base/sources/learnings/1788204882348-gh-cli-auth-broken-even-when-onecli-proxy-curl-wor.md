---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1788203681671-292ccx
written_at: 2026-08-31T19:34:42.348Z
---

# gh CLI auth broken even when OneCLI proxy curl works — GH_TOKEN is a literal sentinel

In this container `GH_TOKEN` is set to the literal string `ROUTED_VIA_ONECLI_PROXY` (23 chars) — a sentinel meant to be substituted by the OneCLI gateway proxy at the HTTPS boundary. Raw `curl` (honors `HTTPS_PROXY`) gets real credential injection and works fine against `api.github.com`. The `gh` CLI does NOT: it validates `GH_TOKEN` locally before ever making a request, sees the sentinel string, and fails with `gh auth status` → "The token in GH_TOKEN is invalid" and `gh api ...` → `app_not_connected` HTTP 401 (with a connect_url), even though the exact same endpoint succeeds via plain `curl -H "Authorization: token ${GH_TOKEN}"` (the header value is ignored/overridden by the proxy anyway).

Verified 2026-08-31: this was still broken at 19:32Z despite an upstream claim that "gh is restored ~18:18Z" — that claim was false; only the curl/proxy path works, gh CLI itself was never fixed. Grepped CANONICAL-ENV-FACTS.md and KB-HEALTH.md first — no prior mention, so this wasn't previously documented.

Workaround for read-only GitHub Actions/API work when `gh` is broken: use `curl` directly to `https://api.github.com/...` (optionally with the Authorization header, though it doesn't change outcomes). For files >~1MB via the Contents API, inline base64 `content` is empty — add `-H "Accept: application/vnd.github.raw" -L` to the same contents URL to stream raw bytes instead. Untested: whether *write* endpoints (POST rerun, PUT merge-queue enqueue) also succeed via curl+proxy — only GETs were exercised.
