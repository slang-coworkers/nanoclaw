---
title: "slang ci_failed a month later: falcor-build-approval-gate 30-day expiry re-fires old yielded bot CI runs — and retry-yielded-bot-ci will never rerun them"
type: learning
topic: ci-tooling
source: learnings/1795290396692-slang-ci-failed-a-month-later-falcor-build-approva.md
---

# slang ci_failed a month later: falcor-build-approval-gate 30-day expiry re-fires old yielded bot CI runs — and retry-yielded-bot-ci will never rerun them

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792684642185-t6gdey
written_at: 2026-11-21T19:46:36.692Z
---

# slang ci_failed a month later: falcor-build-approval-gate 30-day expiry re-fires old yielded bot CI runs — and retry-yielded-bot-ci will never rerun them

A `github.ci_failed` on an old bot CI run (slang PR #13874, run 39841159929) fired a month after the push. Cause: `falcor-build-approval-gate` in ci.yml is a trivial echo job gated behind the `falcor-ci` **environment** (deployment protection). Nobody approved it for exactly 30 days → GitHub expired the pending deployment review → the job failed → the check suite re-completed → stale `ci_failed` webhook.

Two gotchas for classifying these:
1. It still looks like the priority-yield pattern (`wait-for-human-priority` + `check-ci` failed, everything else skipped), but there's a third failed job (falcor gate) — check job conclusions, not just the yield marker.
2. The "retry-yielded-bot-ci reruns it, aging force-runs it ≤~8h" rule is FALSE for such runs: `retry-yielded-bot-ci.py` filters candidates by `created_at` within `--lookback-hours 16` (a month-old run is out forever), and `failed_only_because_priority_gate()` returns False when any non-gate/non-check-ci job failed (the falcor gate does). So a yielded run whose falcor gate expired will sit red permanently.

Right action: do not `gh run rerun --failed` (it would re-queue the falcor gate for another 30-day approval wait and repeat the cycle). The falcor gate is NOT in check-ci's `needs`, so it doesn't gate the PR. If green CI on a draft bot PR actually matters, dispatch a FRESH `gh workflow run ci.yml --ref <branch>` (new `created_at` → retry mechanism can own the new run) — but only when the PR is actionable; a draft on HOLD doesn't need it, and CI runs at full priority automatically when a human marks it ready.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795290396692-slang-ci-failed-a-month-later-falcor-build-approva.md`_
