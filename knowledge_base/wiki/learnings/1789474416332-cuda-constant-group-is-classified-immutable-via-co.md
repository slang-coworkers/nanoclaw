---
title: "CUDA __constant__ group is classified immutable via ConstantBufferType type-case, not AddressSpace::Uniform"
type: learning
topic: misc
source: learnings/1789474416332-cuda-constant-group-is-classified-immutable-via-co.md
---

# CUDA __constant__ group is classified immutable via ConstantBufferType type-case, not AddressSpace::Uniform

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789466047782-q0if00
written_at: 2026-09-15T12:13:36.332Z
---

# CUDA __constant__ group is classified immutable via ConstantBufferType type-case, not AddressSpace::Uniform

**Context:** shader-slang/slang#13088 (PR #13091) — CUDA immutable-load pass emitting `__ldg` for inline `__constant__` launch-param fields.

**Correction (verify at source — a triage memo got this wrong and a reviewer + I both propagated it):**
The synthesized `SLANG_globalParams` launch-parameter group is **NOT** a pointer with `AddressSpace::Uniform`. Its IR is `%globalParams : ConstantBuffer(%GlobalParams, DefaultLayout) = global_param` — i.e. an `IRConstantBufferType` (an `IRUniformParameterGroupType`). An inline uniform read is `load(get_field_addr(%globalParams, field))`, and `getRootAddr` peels FieldAddress/GetElementPtr to `%globalParams`.

`isPointerToImmutableLocation` (slang-ir-util.cpp:3110-3162) then returns true through its **`kIROp_ConstantBufferType` type-switch case at line ~3137**, which sits **before** the `IRPtrTypeBase` address-space branch (~3147-3160). Because the root is a ConstantBuffer type (not a Ptr), the `AddressSpace::Uniform` case (~3154) is **never reached** for this input. So any claim that the group "carries AddressSpace::Uniform" is wrong at the point the pass classifies it.

**Why it matters for a fix here:** `__ldg` (NVRTC `ld.global.nc`) needs a *global* address; the group is immutable but constant-memory, not global. The immutability classification is correct — the discriminator you need is "is it CUDA `__constant__`", which no type/address-space marker records. The only thing that knows is the emitter's rule: an `IRGlobalParam` of `IRUniformParameterGroupType` → `extern "C" __constant__` (`CUDASourceEmitter::emitParameterGroupImpl`; gate in `CLikeSourceEmitter::emitGlobalParam` slang-emit-c-like.cpp:5097). Key a guard on that same predicate.

**Bonus structural coherence:** both the OptiX SBT root and the `__constant__` group are `ConstantBuffer<>`-typed, so both would return true at line 3137. The SBT is excluded earlier at line 3116 (`isAddressIntoOptiXShaderBindingTable`, host-mutated between dispatches); a constant-group guard excludes it before/at the pass (constant-memory address). Two parallel exclusions of ConstantBuffer-typed roots, different reasons.

**Meta-lesson:** the CLAUDE.md "read the actual source, never draft a claim from memory" rule applies to *inherited* claims too — a codex OUTPUT_REVIEW caught this because it re-verified against the IR + predicate rather than trusting the memo/PR prose.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789474416332-cuda-constant-group-is-classified-immutable-via-co.md`_
