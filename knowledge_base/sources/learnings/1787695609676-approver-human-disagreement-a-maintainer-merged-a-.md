---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786709677734-cyi17g
written_at: 2026-08-25T22:06:49.676Z
---

# [approver/human-disagreement] A maintainer merged a test-infra PR over my OPEN_GAP abstain on a future-only CI self-verification hole — abstain was over-cautious for this class

## Outcome
slang#12347 (`slang-static-unit-test` harness) merged by jvepsalainen-nv (MEMBER) at 5ada1d16 —
my EXACT R6 decision commit, 0 interval commits, merged as-is (verified: compare identical; the
merged CI yaml at d0eb95da still has NO pass-floor). I decided ABSTAIN_POLICY / OPEN_GAP at R5 and
R6. Human merged unchanged ⇒ APPROVED-equivalent ⇒ DISAGREEMENT (abstain was over-cautious). Not a
false-safe (I approved nothing), and the gap was real (the head-current primary review confirmed it
as its lead finding) — the maintainer simply judged it acceptable to ship.

## The gap I abstained on
The harness's ordinary CI run had no positive pass-floor: it asserted only `skip harnessSelfCheck`
and `[1-9] ignored`, so a PARTIAL de-registration (substantive tests dropped, the self-check TU's
tests remain and ignore themselves) would print `0 passed, 0 failed, N ignored`, exit 0, and both
greps still match ⇒ green while testing nothing. I called this OPEN_GAP because it "undermines the
PR's stated self-verification purpose" and "uncertainty ⇒ ABSTAIN."

## What the merge teaches (the calibration signal)
For a purely-additive test-infrastructure PR (no source/slang change, CI green, gap #4's real
correctness fix already landed), a maintainer treats a FUTURE-TRIGGER-ONLY self-verification hole —
one that needs a later regression to itself to fire, with blast radius bounded to the tool's own
monitoring — as a mergeable nit / follow-up, not a merge blocker. My "undermines the stated purpose
⇒ OPEN_GAP" reading was defensible but stricter than the maintainer bar for this class.

## Rule (transferable, conservative-lean but recalibrated for this class)
- Distinguish TWO kinds of "gap that undermines the stated purpose": (a) a gap with a CURRENT
  trigger on the supported path (e.g. the earlier gap #4: SLANG_ASSERT throws today ⇒ suite aborts)
  — that one WAS worth blocking/abstaining, and the author fixed it; vs (b) a gap that only fires
  under a hypothetical FUTURE self-edit (partial de-registration that hasn't happened) with
  self-monitoring-only blast radius. Class (b), on an additive test-infra PR with green CI, leans
  toward CLEAR-with-advisory, not OPEN_GAP — the maintainer will merge and treat it as follow-up.
- The tell I under-weighted: NO current input triggers the gap, AND the thing at risk is the test
  tool's own future self-check, not any shipped/compiler behavior. When both hold, an abstain is
  likely over-cautious; surface it as an advisory in the report instead of gating on it.
- This does NOT retract "uncertainty ⇒ ABSTAIN" generally — it sharpens the OPEN_GAP severity bar
  for the specific class "future-only self-verification hole in additive test infra."

## Meta
Across 6 revisions my calls tracked the maintainer well on the substance (the real correctness gap
was raised, fixed, and confirmed fixed); the only divergence was over-caution on this future-only
CI hole. Direction of error: too strict, not too loose — the safe direction for a shadow approver,
but worth recalibrating so the abstain rate on this class comes down.

## Also (recurring, now closed)
Devin was head-stale on ALL 4 runs against this renamed tool (R3-R6), always citing pre-rename
paths. On a tool that was renamed mid-PR, treat Devin as non-signal unless its cited file paths
match the current head's file set.
