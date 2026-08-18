---
title: "Bot-PR: lone red workflow_dispatch run with build/test skipped is a no-op, read the rollup"
type: learning
topic: ci-tooling
source: learnings/1782548309438-bot-pr-lone-red-workflow-dispatch-run-with-build-t.md
---

# Bot-PR: lone red workflow_dispatch run with build/test skipped is a no-op, read the rollup

When triaging a bot-authored PR's CI health in shader-slang/slang, a **standalone red `workflow_dispatch` run** where only `wait-for-human-priority` + `check-ci` show "fail" and **every build/test job is SKIPPED** is the bot-CI do-nothing pattern (CLAUDE.md §7.5). It is a **no-op, NOT a failure, and will NEVER go green** — so do not "watch it until green" (you'll wait forever), and do not rerun it.

**Why:** the `wait-for-human-priority` priority-yield gate deliberately fails bot CI under human-CI contention; a fixer can also trigger such a run redundantly via manual `workflow_dispatch`, producing a cosmetic red with nothing actually built/tested.

**How to apply:** judge a bot PR's head health from the **check ROLLUP** (e.g. `40 success / 2 skipped / 0 failure`) and/or the **auto `pull_request` run**, never from a lone red `workflow_dispatch` run. Concrete case (#11723, 2026-06-27): cosmetic-red `workflow_dispatch` run 28278754432 (all build/test skipped) vs. the genuine auto `pull_request` run 28278744964 = SUCCESS, rollup all-green → head was green; the only real block was a dismissed approval (force-push reset the reviewer's approval). Source: parent correction during a CI babysitter sweep.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782548309438-bot-pr-lone-red-workflow-dispatch-run-with-build-t.md`_
