---
title: "[approver/challenger-miss] On a remediation revision, a STALE Devin snapshot re-flags the already-fixed finding — verify freshness or it drives a false BLOCK"
type: learning
topic: review-approval
source: learnings/1783884242462-approver-challenger-miss-on-a-remediation-revision.md
---

# [approver/challenger-miss] On a remediation revision, a STALE Devin snapshot re-flags the already-fixed finding — verify freshness or it drives a false BLOCK

## Symptom
On the remediation revision of slangpy#1054 (@ebb9f68de — the fix for the version-skew BLOCK I'd recorded @834e0261), Devin's FIRST run came back flagging the EXACT bug I had just blocked on ("Stale native bridge binary... tensor_bridge_api.h:193"), as if nothing had changed. Taken at face value it would have produced a second BLOCK on the very fix I'd asked for — a false BLOCK, and on a re-run, exactly the kind of contradiction that erodes trust in the approver.

## Root cause
Devin (and any external review cache) can return a snapshot pinned to an OLDER commit than the live head, especially right after a fresh push. Two tells exposed it here:
1. Line-number drift: it cited `tensor_bridge_api.h:193`, but the constant is at line **199** at the new head — a 6-line explanatory comment added by the remediation had shifted it. The finding was quoting pre-remediation line numbers.
2. Content omission: the narrative made ZERO mention of the defining change of this head (the `TENSOR_BRIDGE_API_VERSION 7→8` bump and the new stale-rejection test). A genuine head-current review of a remediation commit cannot miss its headline change.
3. `devin-commit-status.txt` read "unknown" (the freshness popover wasn't parsed) — not a positive "up to date" signal.

## How to catch it
On ANY revision/remediation turn, before trusting a Devin (or harvested) finding that matches a PRIOR finding you already resolved:
- Read `devin-commit-status.txt` — a head-current run shows "Analysis is up to date". "unknown"/"out of date"/"behind" = suspect.
- Cross-check the finding's cited file:line against the ACTUAL source at the pinned head (`gh api .../contents/<path>?ref=<sha>`). A line-number mismatch or a finding that describes code the remediation changed = stale snapshot.
- Ask: does the review even mention this revision's headline change? If not, it's not reviewing this revision.
When stale: clear the browser profile (`agent-browser close --all; rm -rf /tmp/agent-browser-*`) and re-run; preserve the stale run under `review/stale-attempt1/` for the audit trail. Attempt-2 here returned "Analysis is up to date", cited the 7→8 bump, and reported 0 bugs.

## Fix (the load-bearing principle)
Direct source verification is the load-bearing signal on a remediation turn; Devin is corroboration, not the driver. I verified the fix at source (version bumped 7→8, compat gate rejects stale v7, new test genuinely asserts rejection with real exported APIs) INDEPENDENTLY of Devin — so even a stale Devin 🔴 could not flip the verdict. A false BLOCK from a stale re-flag is a "challenger-miss" in the opposite direction from a false-safe, but just as damaging: it re-blocks a correct fix. Always confirm the review artifact is pinned to the commit you're deciding on. Pairs with [[approver/critique-mustfix re-pin live head]] — HEAD and the review snapshot can BOTH be behind.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783884242462-approver-challenger-miss-on-a-remediation-revision.md`_
