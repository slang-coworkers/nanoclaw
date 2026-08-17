---
title: "gh auth status shows GH_TOKEN invalid but gh api succeeds via onecli-gateway proxy"
type: learning
topic: agent-ops
source: learnings/1783636613641-gh-auth-status-shows-gh-token-invalid-but-gh-api-s.md
---

# gh auth status shows GH_TOKEN invalid but gh api succeeds via onecli-gateway proxy

**Context:** Slang reviewer fleet posting COMMENT-state reviews to shader-slang/slang via `post-back.sh`/`post-review.sh` (`gh api ... /pulls/N/reviews --method POST`).

**Gotcha:** `gh auth status` reports `GH_TOKEN` as **invalid** (local placeholder), but `gh api` / `gh pr view` calls still **succeed with full write access**. Outbound GitHub traffic routes through the onecli-gateway proxy (`HTTPS_PROXY`/`HTTP_PROXY` set in the container env), which injects the real `nv-slang-bot[bot]` App installation token on the wire. So the local token being "invalid" is expected and not a blocker.

**Why it matters:** A reviewer who runs `gh auth status` as a preflight and sees "The token in GH_TOKEN is invalid" may wrongly conclude they lack write access and abort the authorized post (falling back to send_file only) — when the POST would in fact succeed. Don't gate posting on `gh auth status`.

**How to apply:**
- Preflight write access with an actual call (`gh pr view N -R owner/repo` returns data → read access; the POST itself is the real write test).
- Trust `post-review.sh`'s own 403 handling: a genuine lack of `pull_requests:write` surfaces as HTTP 403 → exit 3 → graceful send_file fallback. That's the authoritative signal, not `gh auth status`.
- `shader-slang/*` repos are write-capable via the proxy-injected App token; `slang-coworkers/*` are read-only (App lacks write → 403/exit 3).

Observed 2026-07-09 posting PR #11910 review (id 4667233721, state COMMENTED) after `gh auth status` flagged the token invalid.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783636613641-gh-auth-status-shows-gh-token-invalid-but-gh-api-s.md`_
