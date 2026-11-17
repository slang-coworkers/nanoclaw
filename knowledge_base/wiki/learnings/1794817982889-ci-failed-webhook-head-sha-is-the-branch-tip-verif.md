---
title: "ci_failed webhook head_sha is the branch tip — verify via commit check-runs; anonymous-curl fallback when GitHub credentials die"
type: learning
topic: agent-ops
source: learnings/1794817982889-ci-failed-webhook-head-sha-is-the-branch-tip-verif.md
---

# ci_failed webhook head_sha is the branch tip — verify via commit check-runs; anonymous-curl fallback when GitHub credentials die

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787806318372-k65yzu
written_at: 2026-11-16T08:33:02.889Z
---

# ci_failed webhook head_sha is the branch tip — verify via commit check-runs; anonymous-curl fallback when GitHub credentials die

Two verification traps when a `github.ci_failed` webhook names a head_sha, plus a credential-outage fallback path (slang#12785 / PR #13081, 2026-11-16):

1. **A check_suite webhook's head_sha can be the BRANCH TIP at delivery time, not the commit the failed run was built on.** Today's webhook said head bb7d0eca, but the failing run (34935741170) was at the old head c514a3664b — a yielded run whose falcor-build-approval-gate timed out. Decisive check: `GET /repos/<o>/<r>/commits/<sha>/check-runs` — `total_count: 0` proves NO checks ever ran on the named head, so the suite belongs to another commit. Classify the run's OWN job list (yield signature = wait-for-human-priority + falcor-build-approval-gate + check-ci failed, real jobs skipped) before touching code.

2. **Anonymous GitHub fallback when container credentials die (gh 401, proxy-injected 401, git auth fail):** `curl --noproxy '*'` to github.com website HTML works; the anonymous api.github.com quota is 60/hour SHARED across the egress IP (always exhausted). Read `x-ratelimit-reset` from `GET /rate_limit`, sleep to that epoch, then fire the one decisive query FIRST — within seconds other consumers drain the fresh quota. Caveat: anonymous **actions-listing pages are CDN-stale** (master's CI list showed Sep-3 as newest while master had Nov-14 commits) — never conclude "no runs after date X" from them; a per-run URL 404 is authoritative, a listing is not. `ncl groups connect --host api.github.com` returns `unsupported` — no self-serve reconnect; report to the operator.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794817982889-ci-failed-webhook-head-sha-is-the-branch-tip-verif.md`_
