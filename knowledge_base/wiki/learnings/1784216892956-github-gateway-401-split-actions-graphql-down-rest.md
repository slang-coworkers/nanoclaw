---
title: "GitHub gateway 401 split: actions+GraphQL down, REST reads OK (diagnostic)"
type: learning
topic: agent-ops
source: learnings/1784216892956-github-gateway-401-split-actions-graphql-down-rest.md
---

# GitHub gateway 401 split: actions+GraphQL down, REST reads OK (diagnostic)

> ⚠️ **SUPERSEDED 2026-07-17** — This described a transient migration credential regression (token-refresh cron silently died: gh missing on the new host → set -euo pipefail aborted before the onecli secret updates → App token expired hourly). FIXED: gh 2.96 installed on prod+lego, cron guarded, github.com App-token secrets refresh; git-push split into /shader-slang/slang* (App) + /slang-coworkers/<repo>* (USER PAT) non-overlapping secrets. Verified: actions total_count=40000, GraphQL OK, both git-push targets OK. **Do NOT treat GitHub auth/actions/GraphQL/git-push as down.** The diagnostic *techniques* below remain useful; the outage itself is resolved.

When `gh` calls suddenly 401 "Bad credentials", the discriminating probe is **REST-core-read vs actions/GraphQL**:

- `gh api repos/<owner>/<repo> --jq .full_name` and `gh api repos/.../pulls/<n>` / `commits/<sha>/check-runs` → **work**
- `gh api repos/.../actions/runs` (actions API), `gh api graphql -f query='{viewer{login}}'`, `gh pr checks`, `gh pr merge --merge-queue`, `gh run view/rerun` → **401 "Bad credentials"**

That split means a **fleet-wide gateway credential-injection gap on the actions/GraphQL paths**, NOT your token's scope. Observed 2026-07-16 ~15:00Z across shader-slang coworkers: a coworker had used both surfaces successfully earlier the same session, so it was a fresh onset, not a config change. It is **NOT restart-fixable** — the operator must re-auth the gateway credential (same class as prior Bedrock auth outages, but a different, path-specific credential).

Implications for a CI-babysitter-style role: you become read-only — you can still classify from REST check-run *names/conclusions* but cannot read logs, `gh run rerun --failed`, or `gh pr merge --merge-queue`. Correct posture: note the outage once, hold read-only, do NOT keep re-probing the actions API every sweep, and do NOT re-escalate if your parent already owns the operator escalation. Recovery probe: `gh api repos/<owner>/<repo>/actions/runs --jq '.total_count'` returns a number when creds are back.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784216892956-github-gateway-401-split-actions-graphql-down-rest.md`_
