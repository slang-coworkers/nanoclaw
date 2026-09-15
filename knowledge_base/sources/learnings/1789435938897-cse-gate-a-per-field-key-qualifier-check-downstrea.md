---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789433439763-si04pd
written_at: 2026-09-15T01:32:18.897Z
---

# CSE gate: a per-field-key qualifier check downstream of getRootAddr() is dead code

When reviewing a Slang read-only/immutability predicate that is invoked as `predicate(getRootAddr(ptr))`, check whether `getRootAddr` (slang-ir-util.cpp ~936–953) *pre-peels the exact access-chain ops the predicate claims to inspect*. `getRootAddr` walks `kIROp_GetElementPtr` / `kIROp_FieldAddress` / `kIROp_NodeOutputRecordGetElementPtr` by taking `getOperand(0)` and **discarding `getOperand(1)` (the field key)**. So any check inside the predicate that inspects a `FieldAddress`/`FieldExtract` field key (e.g. rejecting a per-member `globallycoherent`/`volatile` qualifier via `getOperand(1)`) can never fire on that call path — it is dead code, and worse a latent soundness hole: a per-member coherent/volatile qualifier sitting on the field key of an aggregate whose *root* is immutable-typed (`isPointerToimmutableLocation` true) would be classified repeatable and two loads/wrapper-calls wrongly commoned.

Concrete instance: shader-slang/slang#13081 (issue #12785, "repeatable read-only access" CSE tier). `isRepeatableReadLocation`'s `FieldAddress`/`FieldExtract` `isNonRepeatableQualified(operand(1))` branch is unreachable because both call sites pass `getRootAddr(...)`. Fix pattern: pass the *un-peeled* pointer to the predicate (let its own loop walk the chain and inspect field keys as the single source of truth), or add a regression test with a per-member coherent/volatile qualifier on an otherwise-immutable aggregate to prove the check is reachable. Corroborates the existing shared note "Read-only ≠ value-stable; coherent/volatile lives on IRMemoryQualifierSetDecoration at the field-key level, not in the type."

Also on #13081: `isResourceLoad`'s `ImageLoad`/`ByteAddressBufferLoad`/`SubpassLoad` branches are unreachable in the eligibility walk because `mightHaveSideEffects()` returns true for them (only `kIROp_StructuredBufferLoad`/`kIROp_RWStructuredBufferLoad` are in the no-side-effects bucket), so only structured-buffer wrappers ever get commoned — a missed-opt + overstated comment, not a bug.

Reviewer note: a FileCheck `//CHECK-COUNT-N: <bareName>` guarding "not commoned" is ineffective when `<bareName>` also matches the *emitted function definition* — anchor on the call form (e.g. `loadFrom_0(inputData`) plus `CHECK-NOT`, otherwise the test passes whether or not the calls were wrongly commoned (seen in gh-12785-param-provenance.slang).
