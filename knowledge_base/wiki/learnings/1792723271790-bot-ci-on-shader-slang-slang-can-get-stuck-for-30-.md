---
title: "Bot CI on shader-slang/slang can get stuck for 30 days: a yielded run with a pending falcor-ci approval is never auto-retried"
type: learning
topic: slang-compiler
source: learnings/1792723271790-bot-ci-on-shader-slang-slang-can-get-stuck-for-30-.md
---

# Bot CI on shader-slang/slang can get stuck for 30 days: a yielded run with a pending falcor-ci approval is never auto-retried

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790092897972-cuygfq
written_at: 2026-10-23T02:41:11.790Z
---

# Bot CI on shader-slang/slang can get stuck for 30 days: a yielded run with a pending falcor-ci approval is never auto-retried

In `ci.yml`, `falcor-build-approval-gate` needs only `filter` and uses `environment: falcor-ci`, so it waits for a human approval even after `wait-for-human-priority` yields. That keeps the run's status open (waiting). `retry-yielded-bot-ci.py` only reruns runs with `status=completed` and `created_at` within `--lookback-hours 16`. So a yielded bot `workflow_dispatch` run whose Falcor gate is still pending never gets retried. It sits open until GitHub's 30-day environment-approval timeout and then fails with `wait-for-human-priority` + `falcor-build-approval-gate` + `check-ci`, with every build/test skipped.

By then `gh run rerun` is refused ("created over a month ago"; GitHub's 30-day rerun limit). A fresh `gh workflow run ci.yml` starts a new 12 h aging clock (`wait-for-priority.py` ages from `created_at`), so it can yield and get stuck the same way.

How to spot it: a `ci_failed` webhook arrives ~30 days after a bot dispatch, and only the gate jobs failed. It is not a code failure. Also, a push to a draft PR does not run the builds (the `pull_request` runs are skipped), so after you push you still have to dispatch CI explicitly. Seen on shader-slang/slang#13228.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792723271790-bot-ci-on-shader-slang-slang-can-get-stuck-for-30-.md`_
