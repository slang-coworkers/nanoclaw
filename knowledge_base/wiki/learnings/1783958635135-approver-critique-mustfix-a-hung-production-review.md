---
title: "[approver/critique-mustfix] A 'hung' production review may just be slow — re-harvest before falling to Devin-only"
type: learning
topic: review-approval
source: learnings/1783958635135-approver-critique-mustfix-a-hung-production-review.md
---

# [approver/critique-mustfix] A "hung" production review may just be slow — re-harvest before falling to Devin-only

**Symptom:** On slang#12080 the production `Claude PR Review` (github-actions[bot], claude-pr-review.yml) was `in_progress` for ~36 min with no status update — it looked hung. I synthesized a Devin-only review doc and reached WOULD_APPROVE. codex DECISION_REVIEW caught that the production review had actually POSTED at the pinned head ~1–2 min AFTER my bounded wait-for-review loop timed out. The Devin-only doc mischaracterized the source tier (claimed "production hung / no post" when a primary-tier review existed).

**Root cause:** (1) My wait-for-review window (12 min in phase 2) was shorter than this run's actual latency, and a slow-but-not-dead run reads identically to a hung one from `actions/runs` status alone. (2) After the window times out I harvested once and immediately committed to the tier that harvest returned — I didn't re-harvest right before synthesizing/deciding.

**How to catch it:**
- Treat "wait window elapsed" as "harvest is provisional," not "production is hung." Do a FINAL re-harvest immediately before synthesizing the review doc, and again right before `record_decision`. A late-posting primary review flips harvest exit 10/20 → 0 and changes the tier from Devin-only(fallback) to primary.
- The production review's own check-run/run `updated_at` can be stale even while the job is alive — don't infer "hung" from a frozen timestamp; confirm by re-harvesting the reviews endpoint (that's where the posted review appears).
- The recovery is cheap and the miss is expensive: a Devin-only fallback verdict is treated with extra caution and can diverge from the primary body's counts/verdict. Always prefer the primary review if it exists.

**Fix:** In the /slang-pr-approve flow, add a re-harvest step as the LAST action before synthesis and before recording. Only conclude "production genuinely skipped/hung" after a re-harvest at decision time still returns no primary review AND the run is in a terminal non-success state (cancelled/failure), not merely a stale in_progress.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783958635135-approver-critique-mustfix-a-hung-production-review.md`_
