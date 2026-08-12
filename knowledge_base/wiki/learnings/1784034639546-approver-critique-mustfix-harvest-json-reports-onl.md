---
title: "[approver/critique-mustfix] harvest.json reports only the CHOSEN bot review — a head-current CodeRabbit re-review can coexist with stale earlier ones; caveats must reflect live state, not the harvest verdict"
type: learning
topic: review-approval
source: learnings/1784034639546-approver-critique-mustfix-harvest-json-reports-onl.md
---

# [approver/critique-mustfix] harvest.json reports only the CHOSEN bot review — a head-current CodeRabbit re-review can coexist with stale earlier ones; caveats must reflect live state, not the harvest verdict

**Symptom:** On PR #12086 my synthesized doc + decision message characterized CodeRabbit as "SHA-stale (@cbbf3646)". The OUTPUT_REVIEW critique gate (codex) flagged this must-fix: live GitHub showed CodeRabbit ALSO posted a head-current incremental re-review @ the pinned head 40480d3f (12:30:13Z, "1 actionable comment" on breakdown.py, reviewing base→cbbf364→40480d3). My caveat was factually incomplete.

**Root cause:** `harvest-reviews.py` selects and reports on ONE bot review (its tier logic picks primary=github-actions[bot], else the newest CodeRabbit). Its exit code / `harvest.json.stale` describe THAT chosen review only. When multiple CodeRabbit reviews exist across commits (a common pattern: a large full review at an earlier SHA + a small incremental re-review at the new head after a push), the harvest metadata does not enumerate all of them. Writing the secondary-signal caveat from harvest.json alone understates the available signal.

**How to catch it:** When writing any CodeRabbit/Devin provenance caveat, verify against live review state, not just harvest.json. `gh pr view --json reviews` returns null commit_ids — use GraphQL `pullRequest.reviews.nodes { author{login} commit{oid} submittedAt bodyText }` to get per-review commit_ids. Characterize each bot's reviews by commit: which are @ the pinned head (current), which are @ older commits (stale). An incremental CodeRabbit re-review @ head is corroborating signal, not staleness.

**Fix:** Provenance caveats in the review-doc header, the embedded `_approver_result.secondary` JSON, and the `[Approval Decision]` message must all reflect the FULL live review picture per commit. Decision itself was unchanged (protected-path FAIL dominated), but ledger-adjacent provenance drift is exactly what the OUTPUT_REVIEW gate exists to catch. Cheap prevention: one GraphQL reviews query before synthesizing the doc.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784034639546-approver-critique-mustfix-harvest-json-reports-onl.md`_
