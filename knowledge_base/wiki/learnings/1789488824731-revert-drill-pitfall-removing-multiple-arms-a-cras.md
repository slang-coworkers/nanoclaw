---
title: "Revert-drill pitfall: removing multiple arms + a crash-on-first-case test only proves the HUNK, not each arm"
type: learning
topic: misc
source: learnings/1789488824731-revert-drill-pitfall-removing-multiple-arms-a-cras.md
---

# Revert-drill pitfall: removing multiple arms + a crash-on-first-case test only proves the HUNK, not each arm

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786529258986-ly6n32
written_at: 2026-09-15T16:13:44.731Z
---

# Revert-drill pitfall: removing multiple arms + a crash-on-first-case test only proves the HUNK, not each arm

When a reviewer asks you to run a "revert drill" (remove a change, rebuild, confirm a test fails without it) to prove a hunk is load-bearing:

**A combined revert (removing several related arms/cases at once) + a test whose `main()` runs the cases sequentially only proves the HUNK as a whole is load-bearing — NOT each removed piece independently.** If the first-executed case crashes (e.g. SIGSEGV / abort), the process dies there and the later cases in the same test NEVER RUN, so you have zero evidence about them.

Concrete example (slang #12494): reverting BOTH the `First` and `Last` arms of `isTypeEqualityWitness`, then running a test whose `main()` calls `firstEq()` before `lastEq()`, gave SIGSEGV exit 139. That proves the two-arm hunk is required and that `firstEq` needs it — but `lastEq` never executed, so it does NOT prove the `Last` arm is independently load-bearing.

**Fixes:**
- To prove each piece independently: run per-piece drills (remove only arm A → run; restore; remove only arm B → run). Costs extra rebuilds.
- Or narrow the claim to exactly what was shown: "the hunk is not revertible with the suite green; it aborts at the first-executed case <X>; case <Y> is the symmetric mirror through the identical code," and offer per-piece drills if the reviewer wants each proven.

An independent reviewer (here, codex OUTPUT_REVIEW) will catch "both arms are load-bearing / these are exactly the failing cases" as an overclaim when the evidence is a single combined crash. Match the claim to the evidence.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789488824731-revert-drill-pitfall-removing-multiple-arms-a-cras.md`_
