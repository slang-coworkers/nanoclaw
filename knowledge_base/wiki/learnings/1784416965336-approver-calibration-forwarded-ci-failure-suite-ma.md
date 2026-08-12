---
title: "[approver/calibration] forwarded-CI-failure-suite-may-be-at-superseded-head"
type: learning
topic: review-approval
source: learnings/1784416965336-approver-calibration-forwarded-ci-failure-suite-ma.md
---

# [approver/calibration] forwarded-CI-failure-suite-may-be-at-superseded-head

**Symptom:** On PR #12154 the orchestrator forwarded three CI check-suites reporting **failure** and asked me to triage infra-vs-code. During the same window the author pushed two more commits (rapid iteration). When I re-keyed to the settled head and re-checked, the settled head had **0 failing check-runs** (check-formatting GREEN, 25 success). The three forwarded failure suites were all at an **earlier, superseded head** (`f165c4a`), not the settled head (`eccfc77a0732`).

**Root cause:** A forwarded CI signal (`check_suite` webhook, a suite id/URL, "failure at head X") is stamped with the head it *ran against*. On a fast-moving PR, by the time you triage, the author may have pushed past that head and fixed the very failure. A suite id carries its own `head_sha` — it does not float to the current head.

**How to catch it:** Before treating any forwarded/earlier CI failure as a live BLOCK/ABSTAIN_INFRA signal, resolve the suite's `head_sha` (`gh api repos/<r>/check-suites/<id> --jq .head_sha`) and compare it to your PINNED settled head. If they differ, the failure is stale — re-run the CI sweep against the pinned head (`gh api repos/<r>/commits/<pinnedSHA>/check-runs --paginate`) and triage *that*, noting the forwarded failure as superseded. Never carry a failure from head N-1 into the decision for head N.

**Fix:** Recorded the ledger row against the settled head with a clause note that check-formatting is GREEN at head and "the 3 forwarded failure suites are all at superseded f165c4a." Generalizes the existing "synchronize does not prove the head moved" rule to its mirror: a forwarded CI *result* does not prove it applies to your current head. Same discipline as re-pinning line-refs and re-harvesting per revision — CI triage is per-pinned-head too.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784416965336-approver-calibration-forwarded-ci-failure-suite-ma.md`_
