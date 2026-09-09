---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788478892127-34nirp
written_at: 2026-09-04T01:25:37.044Z
---

# [approver/challenger-miss] SPIR-V debug-type canonicalization: bot 🟡 test-robustness/doc gaps shipped unaddressed (merge-confirmed clears)

## Signal class (for challenger gap-severity calibration on debug-info emit PRs)
slang#12860 ("Canonicalize SPIR-V matrix debug types", `slang-emit-spirv.cpp` + 2 spirv debug-matrix tests) **merged UNCHANGED at the reviewed head** `e8fc1a274964` (merged_by pdeayton-nv, no follow-up commits). The primary `github-actions[bot]` review at head carried a 🟡 verdict with 3 non-pre-existing gaps, ALL of which the maintainer shipped without addressing:
- unbounded FileCheck `CHECK-NOT` for the `%false` (row-vector) form — "can't prove no row-vector form appears later";
- missing explanatory comment on the new unconditional `ColumnMajor=true` matrix debug-type shape (the justifying comment was removed with the old branch);
- `normalizeMatrixDebugType` comment attributing the emitted shape to normalization when the shape is chosen unconditionally in the matrix branch.

## Transferable lesson
For SPIR-V debug-type/debug-info **emit** changes, bot 🟡 gaps of the shape *"FileCheck negative-check not bounded"* and *"missing/misattributed explanatory comment on the emitted record shape"* are, empirically, **maintainer-non-blocking test-robustness/doc nits** — they clear under the challenger's conservative-lean severity bar (no real-world trigger, no blast radius) rather than routing to OPEN_GAP, **provided** the substantive correctness question is independently settled. Here it was: the central design decision (debug type describes value/register shape; `OpMemberDecorate RowMajor/ColMajor` independently describes buffer storage) was verified against the empirical DXC/glslang comparison in issue #12757, and a human MEMBER (jkwak-work) approved the exact head.

## Caveat — do NOT over-generalize to "debug-info emit gaps are safe"
Prior learnings (#12220 DebugEntryPoint silent-drop, #11982 divergent-operand dedup miss) show debug-info emit has a real false-safe surface that byte-valid + spirv-val-clean cannot see. The clears above are specifically **test-assertion-tightness and comment-wording** gaps on a change whose *semantic* correctness was separately established — NOT a licence to wave through a gap about whether the emitted DebugType record itself is correct/deduped. When a 🟡 gap questions the *content or dedup* of the emitted debug record (not just the test's tightness), it still routes to OPEN_GAP: verify dedup with `-dump-ir`, and check for a second producer of the debug inst.
