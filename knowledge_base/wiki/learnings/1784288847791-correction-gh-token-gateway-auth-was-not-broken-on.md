---
title: "CORRECTION: gh/token/gateway auth was NOT broken on 2026-07-17 (transient cred regression, now fixed)"
type: learning
topic: agent-ops
source: learnings/1784288847791-correction-gh-token-gateway-auth-was-not-broken-on.md
---

# CORRECTION: gh/token/gateway auth was NOT broken on 2026-07-17 (transient cred regression, now fixed)

**Retraction of a claim in the earlier learning** "slang-mcp degraded: use unauth GitHub REST fallback for daily report" (2026-07-17 08:21Z).

That learning attributed part of the daily-report failures to an invalid `GH_TOKEN` / OneCLI-gateway auth, and advised telling the operator to "fix the MCP server / token." **That auth-down attribution is retracted.** Per the dashboard admin (2026-07-17 ~11:46Z): the `gh` token / gateway failure that run was a **transient migration credential regression that is now FIXED** — `gh` token is valid, and GraphQL + REST + `git push` are all verified working. Do NOT carry forward an "auth is broken / token invalid / gateway down" assumption for this incident.

**What remains true and worth keeping from the original learning:**
- **The empty-list-looks-like-success trap is real.** Broken list/search tools return `{"issues": [], "total_count": 0}` — a successful-looking empty response, not an error. shader-slang/slang always has open issues, so `total_count:0` across all three repos is a tool-malfunction signal, not "zero new issues." Never report "no new issues" off an empty list without cross-checking.
- **The unauthenticated GitHub REST fallback technique is still useful** for issues/PRs/actions (`https://api.github.com/repos/shader-slang/slang/issues?...`, `/pulls?...`, `/actions/runs?...`, and the raw `health_snapshots.jsonl` snapshot). Keep it as a general resilience technique — but its value is independence from a flaky MCP server, NOT a workaround for broken credentials (which were not actually broken).

**Scope of the failure, corrected:** If `slang-mcp` itself is still flaky, that is a **separate MCP-server issue, unrelated to the (now-fixed) GitHub credential.** Diagnose the two independently: an empty/`Upstream MCP server unavailable` from `slang-mcp` tools is an MCP-server problem; `gh api` / GraphQL / git-push work should NOT be assumed broken.

Related: [[gh-auth-status-shows-gh-token-invalid-but-gh-api-still-works]] and the CONSOLIDATED github-auth learning — `gh auth status` false-negatives are a known separate gotcha; don't conflate them with this incident either.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784288847791-correction-gh-token-gateway-auth-was-not-broken-on.md`_
