---
title: "CORRECTION: GitHub gateway actions/GraphQL 401 outage (07-16) is RESOLVED 07-17 — do NOT hold read-only"
type: learning
topic: agent-ops
source: learnings/1784288884629-correction-github-gateway-actions-graphql-401-outa.md
---

# CORRECTION: GitHub gateway actions/GraphQL 401 outage (07-16) is RESOLVED 07-17 — do NOT hold read-only

## Correction — retracts the 2026-07-16 "GitHub gateway 401 split" outage claim

**The earlier learning "GitHub gateway 401 split: actions+GraphQL down, REST reads OK" (filed 2026-07-16 ~15:00Z) is NO LONGER TRUE.** The outage it described is OVER as of 2026-07-17. Future sweeps must NOT hold read-only or assume actions/GraphQL are down.

### Root cause (dashboard-admin, 2026-07-17)
A **migration credential regression**, not a gateway credential-injection gap as originally hypothesized: the **App-token refresh cron silently died** because `gh` was not installed on the new (migrated) host. With no `gh`, the refresh step failed, so the github.com App token **expired hourly** — every `actions` API and GraphQL call then returned `401 Bad credentials`. The 07-17 05:40Z "write path returns Must-have-admin-rights" symptom was the same expired-token root cause surfacing on the write path, NOT a separate privilege problem.

### Fix (2026-07-17)
- `gh` 2.96 installed on the host.
- Refresh cron **guarded** (won't silently no-op if a dependency is missing).
- All github.com App-token secrets now refresh on schedule.

### Verified recovered (my own probes, 2026-07-17 ~11:47Z)
- `gh api graphql -f query='{viewer{login}}'` → `nv-slang-bot[bot]` (was 401)
- `gh api repos/shader-slang/slang/actions/runs --jq '.total_count'` → `40000` (was 401)
- `gh run list --repo shader-slang/slang` → works (was dead)
- Admin also verified: git-push to shader-slang AND slang-coworkers both succeed.

### How to apply
- **Read-only hold is LIFTED.** Resume full CI sweeps: read job logs, `gh run rerun --failed`, requeue. Do NOT defer classification/reruns citing this outage.
- **Keep the diagnostic TECHNIQUE, drop the outage claim.** The REST-vs-actions-API-vs-GraphQL split (REST reads can succeed while actions/GraphQL 401) is still a useful way to *characterize* a future gateway/cred problem — but that is a probe method, not a current state.
- **If a future 401 cluster appears, re-diagnose from scratch** (which paths fail? is the token-refresh cron alive / is `gh` present on the host?) rather than assuming this specific outage recurred. The tell here was "token expires hourly" — a refresh-cron health check catches it.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784288884629-correction-github-gateway-actions-graphql-401-outa.md`_
