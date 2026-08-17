---
title: "[approver/challenger-miss] A head-current 🔴 caps the decision at ABSTAIN even when you're sure it's a false positive — never round up to approve"
type: learning
topic: review-approval
source: learnings/1785495112092-approver-challenger-miss-a-head-current-caps-the-d.md
---

# [approver/challenger-miss] A head-current 🔴 caps the decision at ABSTAIN even when you're sure it's a false positive — never round up to approve

## Symptom
On slangpy#1082 re-review @3a266be (fallback tier, Devin the sole head-current
signal), Devin raised a 🔴 at `torch_bridge_impl.cpp:126`. I refuted it as a clear
false positive (native buffer pre-check `required_size = 64 + ndim`; torch rank ≤ 64;
both production callers pass a 128-byte buffer, so it can never reject) and drafted
**WOULD_APPROVE**. The codex DECISION_REVIEW gate returned **must-fix**: the skill's
Step-3 asymmetry rule says "investigation can only add caution, never upgrade a
doc's 🔴 toward approval." Correct disposition = **ABSTAIN_POLICY /
CHALLENGER_CONCERN**, not approve.

## Root cause / the rule
The challenger's refutation of a 🔴 is legitimate for one thing: **downgrading a
would-be BLOCK to an ABSTAIN** (avoiding a false block). It is NOT license to round
up to WOULD_APPROVE. When your review doc carries a head-current 🔴 — especially
when it's your ONLY head-current signal (production review absent, CodeRabbit stale)
— the ceiling on the decision is ABSTAIN. Approve requires a review doc that is
clean of 🔴 on its own terms, not a 🔴 you personally talked down. This is the same
thing the standing order says: "never round up to approve; any residual doubt on a
🔴 ⇒ ABSTAIN."

## Two accuracy traps codex also caught (worth repeating)
1. **"Only N in-tree callers" is often wrong for an exposed ABI.** I said "only two
   callers" of `get_signature`; in fact `test_torch_bridge.py` calls the exported
   fn ptr via ctypes (deliberately passing `required_size-1` to assert
   BUFFER_TOO_SMALL). If a function is a published ABI (extern "C" fn ptr in a
   versioned struct), enumerate PRODUCTION call sites and separately acknowledge the
   ABI surface — don't claim a closed caller set.
2. **Cite provenance for a decision-moving external fact.** My "torch max rank = 64"
   came from a *prior session's* deepwiki check, not this session's artifacts. If a
   fact gates the refutation, re-pin it (or label it not-independently-verified) in
   the current session.

## How to catch it
Before writing WOULD_APPROVE: does the head-current review doc contain any 🔴? If
yes, the answer is at most ABSTAIN — full stop — no matter how confident your
refutation is. The refutation belongs in the challenger field (it prevents a false
BLOCK); it does not move you to approve.
Related: [[review-approver-challenger-calibration]] (false-positive refutations),
[[review-approver-decision-procedure]] (four-state mapping).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785495112092-approver-challenger-miss-a-head-current-caps-the-d.md`_
