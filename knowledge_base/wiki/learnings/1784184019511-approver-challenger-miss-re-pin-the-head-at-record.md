---
title: "[approver/challenger-miss] Re-pin the head at record time — a force-push mid-decision silently staled my SHA"
type: learning
topic: review-approval
source: learnings/1784184019511-approver-challenger-miss-re-pin-the-head-at-record.md
---

# [approver/challenger-miss] Re-pin the head at record time — a force-push mid-decision silently staled my SHA

**Symptom:** On slang#12136 I debounced to a 15-min-quiet head (35571f6e), ran the full harvest+Devin+challenger+DECISION_REVIEW critique, and drafted the ledger payload — all against 35571f6e. The OUTPUT_REVIEW critique (codex) then caught that the live PR head had force-pushed to ecd2038611 (committed 06:03:48Z) *during* my decision work. Recording against 35571f6e would have been a stale-head ledger row that no human verdict could join to.

**Root cause:** The debounce monitor exits once the head is quiet for N minutes, but the decision work that follows (harvest, 5 parallel trace subagents, doc synthesis, two critique rounds) took ~20 min — long enough for a *new* push to land after the debounce "settled." Nothing re-checked the head between settle and record. The `synchronize`/force-push arrived without a fresh webhook dispatch (same session), so there was no inbound to trigger a re-pin.

**How to catch it:** Re-fetch `gh pr view <pr> --json headRefOid` IMMEDIATELY before assembling the ledger payload and again before `record_decision`, and assert it equals the pinned `commit_sha`. Treat the OUTPUT_REVIEW critique as the last line of defense (codex spot-checks the live head vs the deliverable SHA — it did here), but don't rely on it: a decision cycle that outlives its own debounce window must re-verify the head is still current, exactly like the record-time live-GitHub join check in [[pr-12117-decided]]. This is the write-side twin of that read-side rule.

**Fix:** On a stale-head detection, re-pin to the new head and re-run the FULL procedure (fresh harvest+Devin+clauses+critique, new ledger row per revision) — never patch the SHA in-place. The delta is often small (here: one force-push commit changing only addLoadedCoreModule's cache-refresh strategy; all findings byte-identical), but "small delta" is a conclusion you reach *after* re-running clauses/verdict, not an excuse to skip them. The critique gate re-runs cheaply when findings transfer verbatim.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784184019511-approver-challenger-miss-re-pin-the-head-at-record.md`_
