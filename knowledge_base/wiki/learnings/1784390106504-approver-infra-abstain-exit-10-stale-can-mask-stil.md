---
title: "[approver/infra-abstain] exit-10-stale-can-mask-still-running-primary-claude-review"
type: learning
topic: review-approval
source: learnings/1784390106504-approver-infra-abstain-exit-10-stale-can-mask-stil.md
---

# [approver/infra-abstain] exit-10-stale-can-mask-still-running-primary-claude-review

**Symptom:** On PR #12154 @ settled head, `harvest-reviews.py` returned **exit 10 (STALE)** — the newest bot review was CodeRabbit against an *older* commit. The workflow's exit-10 branch says "fall to Devin-only, note staleness." I synthesized a Devin-only fallback doc and derived the decision — reporting the production claude review as "absent for this head." The codex OUTPUT_REVIEW gate caught it: a `review` check-run was still `in_progress` at the pinned head.

**Root cause:** exit-10 (a stale *review exists*) is a **different signal** from exit-20 (genuine skip) and exit-22 (pending bot named). But exit-10 can co-occur with a still-running PRIMARY: the harvester keys "stale" off the newest *posted* review (CodeRabbit) and does not re-check whether the production `github-actions[bot]` claude review (`.github/workflows/claude-pr-review.yml`) is still in-flight. So exit-10 silently discarded the primary signal that was 15 min from landing — the same class of miss as slang#12064's `harvest_used=0` (there via exit-22, here masked behind a stale secondary).

**How to catch it:** On ANY harvest result that is not exit-0-primary (10/20/22), independently check the commit's check-runs for a `review`-named run whose app is `github-actions` and workflow path is `.github/workflows/claude-pr-review.yml`. If its status is `queued`/`in_progress`, treat it exactly like exit-22 `pending_bot`: WAIT (poll ~30s up to ~6-15 min) and re-harvest — do NOT fall to Devin-only. `gh api repos/<r>/commits/<sha>/check-runs --jq '.check_runs[]|select(.name=="review")|"\(.status):\(.conclusion)"'`; resolve the run's workflow via `gh api .../actions/runs/<id> --jq .path`.

**Fix:** Waited ~15 min for the run to settle → `completed:success`, re-harvested → exit-0 PRIMARY (github-actions[bot]) @ pinned head. Decision outcome was unchanged here (a terminal protected-path clause fail dominated regardless of tier), but the *derivation* was corrected from a false "primary absent / Devin-only" to an honest "primary harvested." The tier statement is audited and must be true even when the clause fail makes it decision-neutral — a future PR without the clause fail would have shipped a real false-safe on this same sequencing bug.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784390106504-approver-infra-abstain-exit-10-stale-can-mask-stil.md`_
