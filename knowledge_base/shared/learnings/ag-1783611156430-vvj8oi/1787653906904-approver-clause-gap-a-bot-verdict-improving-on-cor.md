---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786989400334-cxstzf
written_at: 2026-08-25T10:31:46.904Z
---

# [approver/clause-gap] A bot verdict improving 🟡→✅ on correctness grounds does NOT close a coverage-gap abstain

**Scenario.** shader-slang/slang#12574, R3 re-gate @a9a8e3861fe9. I had abstained twice on distinct OPEN_GAPs. Between R2 and R3 the author pushed one commit ("Give the pre-prelink decoration invariant a name and a single home") — a *pure refactor* extracting `reproduceInterfaceDecorationsReadBeforePrelink`, no test. Meanwhile the production Claude review's verdict jumped from 🟡 (2 gaps) to ✅ "No correctness, security, or IR issues found" (4 sub-reviewers + clarity), and Devin stayed clean.

**The trap I avoided.** It is tempting to read "production now says ✅, and there was a fresh commit" as "the gap is resolved → approve." It is not. My R2 abstain was a *coverage* gap: the load-bearing obfuscation guard at `slang-lower-to-ir.cpp:12178` is untested for the precompiled-lib-without-obfuscate → consume-with-obfuscate scenario. The refactor commit closed a *different* gap (the prose-only invariant), and added no test. A bot verdict improving on **correctness** grounds says nothing about a **coverage** gap — those are orthogonal axes. Per the skill: "investigation can only add caution, never upgrade"; a cleaner bot verdict is investigation, not a test.

**Rule.** When re-gating a synchronize on a PR you abstained on for a *coverage* gap: (1) identify the exact test that would close it and grep for it at the new head — don't accept a refactor or a comment fix as closure; (2) treat an improved bot verdict as a correctness signal only, never as coverage; (3) if the gap's reachability is unverifiable from artifacts (here: does the borrow path fire for a serialized `-r` precompiled import?) and the blast radius is a hard crash, "inability to complete the check ⇒ ABSTAIN." Decision held at ABSTAIN_POLICY/OPEN_GAP across R2→R3 for the same reason — consistency is correct when the interval commits didn't touch the flagged gap.

**Calibration note.** The loop IS converging: R1 gap (COM branch untested) → closed with a falsifiable test in R2; R2 prose-invariant → closed by refactor in R3; the obfuscation-guard test gap remains. Each abstain named a concrete, addressable ask and the author closed each prior one, which is the abstain mechanism working as intended — not the approver being obstinate.
