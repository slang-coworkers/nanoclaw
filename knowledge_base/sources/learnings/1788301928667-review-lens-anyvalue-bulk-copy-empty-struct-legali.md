---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788299852682-tolqo2
written_at: 2026-09-01T22:32:08.667Z
---

# Review lens: AnyValue bulk-copy / empty-struct legalize fixes — check the target branch is numerically exercised, not just compiled

From reviewing shader-slang/slang#12875 (bulk-copy autodiff backward-context structs; lift empty-struct reject in `countWordScalarLeaves` + new `legalizeBitCast` for degenerate empty `bit_cast`).

**Test-coverage lens (recurring gap in dynamic-dispatch/autodiff fixes):** the fix's *target* path was the `Foo2` conformer whose constant derivative makes its saved payload dead, so its context collapses to empty and drives the new zero-fill. But the `-cpu` test dispatched only thread 0 under `numthreads(1)`, which selects `Foo1` — whose context is empty from the start and is NOT the interesting case. So the collapsed-context path was verified only *structurally* (`CPP-NOT: packAnyValue…(s_bwdCallableCtx`), never *numerically*. A live-payload miscompile in the changed path would still compile through and pass `CPP-NOT` silently. Lens: when a bulk-copy/legalization fix targets a specific conformer/branch, confirm a runtime `-cpu` COMPARE_COMPUTE actually *routes through that branch and pins its result* (here: dispatch `Foo2` too and assert `d/dv(2·v)=2`). Both Reviewer A (correctness) and the clarity pass flagged the structural-only coverage.

**Legalize-handler lens (silent-impossible-shape smell):** the new `legalizeBitCast` Form-2 (source *type* legalizes to `none` → `emitDefaultConstruct` zero-fill) sits in the SHARED all-targets `legalizeInst` switch, converting the pre-existing loud `SLANG_UNEXPECTED("non-simple operand(s)!")` into a silent default for *any* empty-source bit-cast on any target — not scoped to its only intended producer (the C/CUDA AnyValue bulk-copy fast path). Three correctness subagents independently converged on this — it's exactly CLAUDE.md's "silent impossible-shape handling" red flag. Principled hardening: `SLANG_ASSERT(as<IRAnyValueType>(type.getSimple()))` before the zero-fill so every other empty-source bit_cast keeps failing loudly. Gating on the source TYPE (not the operand value) is correct and matters: `legalizeUndefined` also lowers an undefined value of a non-empty type to an empty LegalVal, and that must keep tripping the assert.

**Confirmed-safe note (addresses the prior "shape-keyed legalize gating is B/C-risky" learning 1783995257092):** the handler gates on "source type legalizes to `none`" (emptiness), NOT on synthesized IntLit dimensions, and ordinary fully-simple bit-casts short-circuit in `legalizeInst` (dispatched only when `anyComplex || flavor != simple`) before ever reaching the handler — so the abort is unreachable for common simple casts. Independently verified by both Reviewer A and Reviewer C (C002).

Outcome: 3-reviewer verdict APPROVE_WITH_NITS — 0 correctness bugs (A, Devin, and clarity all agree), the two items above are the actionable nits.
