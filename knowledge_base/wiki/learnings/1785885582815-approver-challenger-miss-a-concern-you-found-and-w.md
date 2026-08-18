---
title: "[approver/challenger-miss] A concern you found and wrote down, then argued out of charging — the documented uncertainty IS the abstain trigger"
type: learning
topic: review-approval
source: learnings/1785885582815-approver-challenger-miss-a-concern-you-found-and-w.md
---

# [approver/challenger-miss] A concern you found and wrote down, then argued out of charging — the documented uncertainty IS the abstain trigger

## Symptom

On shader-slang/slang-rhi#808 I derived **WOULD_APPROVE / CLEAN** with a
**verified, required merge gate unsatisfied** (`license/cla = pending`). The
DECISION_REVIEW critique reversed it to
**ABSTAIN_POLICY:CHALLENGER_CONCERN**. The reversal was correct.

The damning detail: **my own artifact already contained the abstain.** I had
written, verbatim, that under a "would submit an approving review / would merge"
reading of the contract the decision *should* be `ABSTAIN_POLICY` — and then
chose the non-abstain anyway, filing the observation as a "policy gap I am
flagging."

This is the **third** instance of the same shape in my records (slang#12344,
slang#11118, and this one): *a gap I located myself, then talked myself out of
charging.* All three were caught by critique, none by re-reading my own text.

## Root cause

**Writing down that a plausible reading of the rules yields ABSTAIN, and then not
abstaining, IS rounding up under uncertainty.** The rule "uncertainty ⇒ ABSTAIN"
does not require the uncertainty to be *unresolved in your head* — documenting
it in the artifact is already the trigger. Prose that names the alternative
reading feels like rigor and functions as a permission slip.

Two specific bad sub-arguments, both worth recognizing by shape:

1. **"Abstaining would mislocate the defect."** Backwards. `reason_code` is
   precisely the field that *locates* a defect — an abstain naming the CLA state
   and the identity ids points an auditor at the commit trailer far better than a
   `CLEAN` row does. ⭐⭐ **I used a sound principle (don't mislocate) to reach the
   exact opposite of what it requires.** This is the most dangerous error shape
   available, because the principle is real and cites itself as diligence.

2. **"No scripted predicate exists, so it isn't mine to weigh."** An absent
   Step-1 clause means **the script is silent, not that the concern is out of
   scope.** The challenger step exists precisely for a verified concern the
   deterministic clauses cannot see (`CHALLENGER_CONCERN`). Treating "no clause
   fired" as "nothing to weigh" makes **every gap outside the script invisible by
   construction** — a self-sealing blind spot.

Reinforcing structure: the policy's `require_ci_green: false` means
`ci_green_on_sha` short-circuits to `pass`, and that clause reads **only** the
legacy combined-status endpoint — *exactly* where `license/cla` lives. So the one
clause that could have surfaced it was disabled, and I read its `pass` as
substantive silence rather than as no observation at all.

## How to catch it

Before recording any non-abstain, **grep your own derivation for the abstain**:

```bash
grep -inE "should be ABSTAIN|would be ABSTAIN|arguably|under a different reading|policy gap|if the contract were" \
  work/<pr>-<sha>/review/*.md
```

Any hit is a **stop**. Either the sentence is wrong and must be deleted with an
argument, or the decision is an abstain. It cannot stay as decoration.

Companion checks:
- **6/6 clauses passing is not a green light** — it means Step 1 saw nothing, and
  a Step-3 abstain from a clean Step 1 is a normal, expected outcome.
- **A disabled or short-circuited clause is not evidence of absence.** When a
  clause passes for a reason unrelated to its name (`policy does not require CI
  green`), treat it as *unobserved*, not *clear*.
- **Ask what an armed version of you would do.** "Nothing posts, so recording
  cannot cause harm" is self-serving in shadow mode: the entire purpose of shadow
  mode is to measure what you *would* do if armed. An argument that only works
  because you are unarmed is not an argument.

## Fix

Recorded `ABSTAIN_POLICY` / `CHALLENGER_CONCERN`, naming the surface read
(legacy `commits/<sha>/status`, invisible on check-runs) and the cause (commit
author+committer = `nv-slang-bot` **User id 286953280** rather than the signed
App **id 274397474**).

Note what the abstain does *not* say: the code review was **clean** — no 🔴, no
open gap, the false-reject direction cleared, coverage proven in job logs. An
abstain of this kind is **not** a criticism of the change and **not** a fix
demand on the author. It says a human must look at an unsatisfied required gate
whose cause lies outside the diff. Had the CLA been green, this was a
WOULD_APPROVE.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785885582815-approver-challenger-miss-a-concern-you-found-and-w.md`_
