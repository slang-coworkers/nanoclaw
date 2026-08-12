---
title: "[approver/challenger-miss] On a live multi-revision PR, a production bot review that lands on a PRIOR head is stale-as-verdict-source but strong corroboration — harvest still surfaces it, use it as an independent agreement signal"
type: learning
topic: review-approval
source: learnings/1783959025798-approver-challenger-miss-on-a-live-multi-revision-.md
---

# [approver/challenger-miss] On a live multi-revision PR, a production bot review that lands on a PRIOR head is stale-as-verdict-source but strong corroboration — harvest still surfaces it, use it as an independent agreement signal

**Context:** slang#11475 across four revisions (R0 BLOCK → R1 BLOCK → R2 ABSTAIN → R3 ABSTAIN). By R3, `harvest-reviews.py` returned exit 10 (STALE), but the newest posted bot review was no longer the ancient `97c26f7` one — the production `github-actions[bot]` had reviewed the **R2** head `84480de94f7f` (~18 min after my R2 decision) and that review was what harvest surfaced as "stale vs R3 head."

**Insight:** On an actively-force-pushed PR, the production review CI eventually catches up and posts against whatever head existed when it ran — which is often the head you decided *last revision*, not the current one. That review is correctly **ignored as the verdict source** (it's stale vs the current head; the workflow falls to head-current Devin), BUT it is **strong independent corroboration**: it's a full production-pipeline review of a head your own prior decision covered. Read its body (`harvest.json.body`) and compare its verdict/findings to what you decided on that same head.

Here the R2-production review returned **🟡 0 bugs, 4 gaps** — "The core logic is correct — memory-safety, IR/checking-correctness, and doc-accuracy passes found no bugs" — which independently matched my R2 no-🔴 read and my R2 gap set (fwd_diff untested, two-branch getThisTypeForBaseFunc, untested [*DerivativeOf] path). That agreement raises confidence that the ABSTAIN (not BLOCK, not APPROVE) calibration was right, and it's worth stating explicitly in the challenger/record as corroboration.

**How to use it:** (1) Don't discard a stale harvest — inspect which commit it reviewed; if it's a head you previously decided, treat it as a retroactive agreement check on that decision. (2) Keep it clearly labeled "corroboration, not verdict source" in the review doc + ledger challenger (the head-current Devin run remains the verdict source). (3) If the stale production review CONTRADICTS your prior decision on that same head (e.g. it found a 🔴 you cleared), that's a challenger-miss signal worth an immediate `[approver/challenger-miss]` or `[approver/false-safe]` note.

**Bonus calibration:** the four-revision arc tracked the code faithfully — decision severity fell exactly as the author fixed verified bugs (R0/R1 decl-side arg-count 🔴 → fixed by R1 rework, confirmed by Devin R2's param-count-guard note) while residual completeness gaps kept it at ABSTAIN, never rounding up to approve. Related: [[approver-challenger-miss-revision-fixup-can-fix-the-flagged]], [[approver-clause-gap-autodiff-member-method-changes-must-be]], [[approver-reviewer-debounce-live-pr-head-churn-then]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783959025798-approver-challenger-miss-on-a-live-multi-revision-.md`_
