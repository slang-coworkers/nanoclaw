---
name: feedback_broader_read_access_is_not_higher_authority
description: "Broader read access is not higher authority on a specific fact. Four times in one session a claim from Main lost to a dated local artifact held by a narrower-access coworker — resolution always came from reading the reference, never from re-arguing."
metadata:
  node_type: memory
  type: feedback
---

# Broader read access is not higher authority on a specific fact

**2026-08-04, named by slang-fixer after four instances in one session. All four were mine.**

My tier has strictly wider reach — `ncl` at global scope, the approvals ledger, GitHub reads coworkers
are gated from. **That is breadth, not correctness on any particular claim**, and today it lost four
times to a narrower-access coworker holding a *dated artifact*:

| my claim | what beat it |
|---|---|
| "805×4 rhi sessions in your group" | its own edge measurement (mine was an unfiltered + truncated page) |
| "`:3697` doesn't exist — your citation is off" | `git diff base...branch` — the line was one the PR *adds* |
| "the CUDA signatures are the measured version of the defect" | the IR dump — CUDA prints a raw pointer for **every** by-reference mode |
| "#12192 unparks when #12336 merges" | its `hold-12192.md`, with an explicit trigger sentence, a verification date, and the blocker's head SHA |

⇒ ⭐⭐⭐**In every case the resolution came from READING THE REFERENCE, never from re-arguing the
conclusion.** Whichever of us sounded more certain was irrelevant; the artifact with a date and a SHA in
it won. **Recency and authorship are not evidence** — and neither is scope.

⚠️**The #12192 one is the worst of the four because my own store had it right.** `#12192 UNPARKS` sits in
the **#12185/#12186** row of my index, correctly. I attached its trigger to the wrong chain while writing
a close-out. ⇒ **A misread of your own record is indistinguishable from not having it** — and it fails in
the dangerous direction: a wrong unpark trigger doesn't error, it fires at the wrong time and the
resumed work looks legitimately started.

## ✅ What made the coworker's record win — the anatomy worth copying
Its `hold-12192.md` beat my confident sentence for identifiable reasons, and as the tier that dispatches
and re-dispatches parked work, **this is the shape I should require:**
1. **An explicit trigger sentence** — `Resume trigger = PR #12186 merges`, not "waiting on the bindless work."
2. **A verification date** — so staleness is visible rather than inferred.
3. **The blocker's head SHA** — pins *which* revision the claim was true of.
4. **Prior corrections left visible as a banner**, not silently overwritten — so a reader sees what was
   wrong and why, and can judge the record's care.

⇒ ⭐⭐**A parked-work record with those four properties survives contradiction from a higher tier. One
without them loses to any confident claim, correct or not.**

## Corollary for how I should behave
- **Before contradicting a coworker's source claim, ask what instrument could settle it** — and prefer
  theirs when the fact is local to their branch/edge/container ("different visibility, not ordered
  visibility," from the same session).
- **State epistemic status when relaying:** verified-by-me vs. attested-by-them vs. inferred. Three of
  the four above were me relaying an inference in the register of a measurement.
- ⭐**Do not learn "challenge less."** Two of the four exchanges materially improved the outcome (the
  `Ref`-inlining blast radius; demoting the CUDA evidence). **The fix is asking the right question
  first, not asking fewer.**

Related: [[feedback_a_correct_action_does_not_validate_its_rationale]] (accuracy ≠ provenance),
[[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] (the count instance),
[[feedback_a_guard_can_be_inert_and_read_as_passing]] (the CUDA-evidence instance).
