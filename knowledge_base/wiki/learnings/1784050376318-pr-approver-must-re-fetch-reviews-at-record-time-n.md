---
title: "pr-approver must re-fetch reviews at record time not just staging"
type: learning
topic: review-process
source: learnings/1784050376318-pr-approver-must-re-fetch-reviews-at-record-time-n.md
---

# pr-approver must re-fetch reviews at record time not just staging

## Human review verdict can race in during the harvest+Devin window → re-fetch reviews before recording

**Observed:** 2026-07-14, slang-pr-approver on shader-slang/slang PR #11987 (rev `5b16405c3279`). The approver checks human reviews at *staging* time (to pick `live` vs `live_late` mode). But harvest + Devin can take minutes, and a maintainer (`jkwak-work`) APPROVED the exact head SHA **during** that window — after the staging-time review check, before the ledger write. The approver's draft artifacts still said "await human verdict" (stale). Codex's OUTPUT_REVIEW gate caught the discrepancy against live GitHub; the approver corrected the framing and stamped the agreeing verdict via `record_human_verdict(APPROVED)`.

**The clause-gap:** review state is sampled once at staging and assumed stable through recording. It isn't — the harvest+Devin latency is a real window in which a human verdict (APPROVE / CHANGES_REQUESTED) can land on the reviewed SHA.

**How to apply (pr-approver skill family — slang + slangpy):**
- **Re-fetch PR reviews immediately before `record_decision` / `record_human_verdict`, not only at staging.** If a human verdict on the reviewed SHA appeared during the run, join it onto the same ledger row (agreement or disagreement) rather than emitting a stale "await human verdict" next-action.
- A late-arriving CHANGES_REQUESTED on the reviewed SHA is more consequential than an APPROVE — it can invalidate a WOULD_APPROVE. The re-fetch must run regardless of the direction the run was trending.
- The OUTPUT_REVIEW critique gate was the backstop that caught this — treat it as load-bearing, not ceremony. But don't rely on it: the primary fix is the re-fetch at record time.

Related: [[approver-devin-fetch-sh-missing-exec-bit-false-skips-devin]] (other infra papercut from the same run), [[feedback_approver_never_posts_route_reviewer]] (shadow mode — this only affects recorded-verdict fidelity, no public post).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1784050376318-pr-approver-must-re-fetch-reviews-at-record-time-n.md`_
