---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477844138-bpkgpn
written_at: 2026-08-27T19:21:14.414Z
---

# [approver/challenger-miss] a pass-REORDER PR needs BIDIRECTIONAL safety analysis + a specialization-identity check

**Symptom:** On slang#12435 R4 (a revision that MOVED the `specializeMatrixLayout` pass in `linkAndOptimizeIR`), I first cleared the reorder with a one-directional argument ("the pass now runs after `specializeModule`, so it just adds coverage of lazily-cloned matrices — strict widening"). The critique gate (codex) correctly rejected this across three rounds. It took 8 OUTPUT_REVIEW rounds to converge because I kept under-analyzing the move.

**Root cause:** Moving a compiler pass has TWO independent safety directions, and a "coverage" framing only covers one:
1. **FORWARD** — does the pass now run after something that produces work it must handle? (the move's *purpose*). Easy to see.
2. **BACKWARD** — do any passes the moved pass now runs *after* (i.e. that it CROSSED, which previously ran after it) DEPEND on its output? If they read the state the pass produces, they now see the pre-pass state and may regress. Easy to MISS. You must enumerate every crossed pass (diff the pass list at the merge-base vs the head — do NOT assume the move only crosses the one pass the comment mentions; #12435 crossed FIVE) and check each for a read of the moved pass's output.
3. **SPECIALIZATION-IDENTITY (the subtle one):** if a crossed pass is `specializeModule` (or anything that keys/dedups on `IRInst*` POINTER identity, e.g. `IRSimpleSpecializationKey`), then even if it never *reads* the operand the moved pass rewrites, the move changes WHICH inst-identity it sees (unresolved vs resolved). For a type whose operand is part of IR identity (matrix layout, address space, etc.), a value used as a generic ARGUMENT in both an implicit and explicit form could dedup differently. A grep for `getLayout()`/direct reads does NOT rule this out.

**How to catch it:** For any pass-move PR: (a) reconstruct the merge-base pass order (`git show <merge-base>:file`) and list EVERY pass crossed; (b) for each, verify it doesn't consume the moved pass's output (BACKWARD); (c) if `specializeModule`/defunctionalize/any pointer-identity-keyed pass is crossed, explicitly reason about mixed implicit/explicit forms of the affected type as generic args; (d) check whether the exposure is actually NEW at this revision — #12435 R3 (already approved) had the same "after specializeModule" relation, so the concern was inherent to the fix, not an Rn regression.

**Also (self-discipline):** I claimed the shipped test "resolved" the identity concern — but the test used only DEFAULT-layout matrices; it never exercised the mixed case. Retracted. A test "covers" a concern only if it exercises the exact shape the concern is about; a green test on the adjacent-but-different shape is not a control. Don't label a concern "resolved" when the honest state is "residual, no repro, cleared conservative-lean."

**Fix / rule:** Treat a pass-move as bidirectional-plus-identity. Enumerate crossed passes from the merge-base; verify no consumer regresses; reason about pointer-identity dedup for identity-bearing operands; and distinguish "resolved" (a control exercises the exact shape) from "residual, cleared conservative-lean" (no repro + reviewers + structural argument). When you cannot close a residual by static analysis but it is not a demonstrated trigger and not new vs a prior approved revision, WOULD_APPROVE-with-documented-residual is defensible; claiming it "resolved" is not.
