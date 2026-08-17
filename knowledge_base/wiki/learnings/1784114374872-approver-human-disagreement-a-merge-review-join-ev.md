---
title: "[approver/human-disagreement] a merge/review JOIN event is a claim to verify against live GitHub, not evidence to stamp — refuse record_human_verdict when the merge SHA doesn't resolve"
type: learning
topic: review-approval
source: learnings/1784114374872-approver-human-disagreement-a-merge-review-join-ev.md
---

# [approver/human-disagreement] a merge/review JOIN event is a claim to verify against live GitHub, not evidence to stamp — refuse record_human_verdict when the merge SHA doesn't resolve

**Symptom:** After deciding #12117 WOULD_APPROVE (CLEAN) @47deb4efaf55, the orchestrator sent a join: "#12117 MERGED by skiminki-nv @b8f1c2a0, human verdict=APPROVED, call record_human_verdict." Looked like clean positive calibration (agreement). But querying live GitHub before stamping: `gh pr view 12117 --json state,closed,mergedAt,mergeCommit` → **state=OPEN, closed=false, mergedAt=null, mergeCommit=null**; head still 47deb4efaf55; and the cited merge commit `b8f1c2a0` → `gh api repos/<repo>/commits/b8f1c2a0` **HTTP 422 "No commit found for SHA."** The PR was not merged; the merge SHA didn't exist.

**Root cause:** Join events (orchestrator-forwarded `github.pr_merged`/`pr_closed`/`pr_review`) are upstream *claims*, and they can be wrong — mistyped/hallucinated SHA, premature fire, or a different PR conflated. `record_human_verdict` stamps the agreement-scoring ledger; stamping an uncorroborated "APPROVED" writes a FABRICATED agreement that inflates calibration accuracy — the exact metric the shadow system exists to measure honestly. "Decisions are joined against human outcomes; never round up to approve" applies to the JOIN too, not just the decision.

**How to catch it:** Before EVERY `record_human_verdict`, verify the join against source (2 cheap reads):
1. `gh pr view <pr> --repo <repo> --json state,closed,mergedAt,mergeCommit,headRefOid` — a real merge shows state=MERGED (or closed=true) + non-null mergedAt/mergeCommit. state=OPEN ⇒ the join is wrong, full stop.
2. If a merge/closed SHA is cited, resolve it: `gh api repos/<repo>/commits/<sha>`. HTTP 422/404 ⇒ the SHA is fabricated ⇒ do not stamp.
3. Cross-check the SHA the join cites against the SHA your ledger row is keyed on (your decision head). record_human_verdict is a no-op host-side if no row exists for (repo, pr, commit_sha), so a mismatched/non-existent SHA can't stamp your actual row anyway.

**Fix:** When the join fails verification, do NOT call record_human_verdict. Report the discrepancy upstream on the canonical thread with the concrete evidence (state, mergedAt, the 422), keep the decision row unstamped, and wait for a corrected join with a resolvable merged/closed SHA. Note it in the PR memory file so a re-sent join is handled correctly. Stamping is cheap to defer and impossible to cleanly undo once it pollutes agreement scoring.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784114374872-approver-human-disagreement-a-merge-review-join-ev.md`_
