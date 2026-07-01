---
title: "slang-spirv-asm-operand-builtinvar-is-hoistable-collapses-cross-stage"
type: learning
topic: slang-compiler
source: learnings/1779617050641-slang-spirv-asm-operand-builtinvar-is-hoistable-co.md
---

# slang-spirv-asm-operand-builtinvar-is-hoistable-collapses-cross-stage

# IRSPIRVAsmOperandBuiltinVar is hoistable — cross-stage builtin refs always collapse to one inst

**TL;DR** — Adding a cache-key axis to `BuiltinSpvVarKey` in `slang-emit-spirv.cpp` to differentiate cross-stage uses of the same builtin (e.g. compute + raygen sharing `SubgroupLocalInvocationId`) is dead code under today's IR. The IR pipeline collapses both call sites to a single `IRSPIRVAsmOperandBuiltinVar` at module scope before reaching the SPIR-V emit cache.

**Mechanism (verified Dec 2026 in `pr-11265-r2-reviewerA` IR investigation):**
- `IRSPIRVAsmOperandBuiltinVar` is declared `hoistable=true` in `source/slang/slang-ir-insts.lua:2794-2798`.
- The `kIROpFlag_Hoistable` flag routes `_createInst` through `_findOrEmitHoistableInst` (`source/slang/slang-ir.cpp:1850-1886`), which performs global value numbering keyed by `(op, type, operands)`.
- The dedup'd inst is parented at module root via `addHoistableInst`. After `[ForceInline]` inlining, both `cs()` and `rg()`'s `spirv_asm { OpLoad builtin(SubgroupLocalInvocationId:uint) }` reference the SAME single inst.
- `buildEntryPointReferenceGraph` (`source/slang/slang-ir-call-graph.cpp:60-96`) then attributes the shared inst to {cs, rg} — so any "is this builtin used in any raytracing stage?" predicate sees both stages and returns "yes" once for the shared inst.
- Result: `getBuiltinGlobalVar` is called once with the shared `irInst`, produces ONE `OpVariable`, ONE cache entry.

**What WOULD make a cross-stage cache axis fire:** an IR pass that splits hoistable spirv_asm operands per referencing entry point before SPIR-V emit (none exists today), or a non-asm `getBuiltinGlobalVar` call site whose builtin is in the volatile-required whitelist (none exists — semantic-decoration lowering at `source/slang/slang-emit-spirv.cpp:7278+` only handles SV_* builtins).

**Apply when:**
- Reviewing PRs that add cache-key axes to differentiate behavior across stages for spirv_asm-lowered builtins. The axis is forward-compat scaffolding, not load-bearing.
- Designing tests for "different decoration on same builtin in different stages" — single-module multi-entry-point tests do NOT exercise the divergence; they exercise the over-conservative shared-inst path.
- Pinning the dual-OpVariable behavior would require a synthetic unit test that constructs two non-deduped IRSPIRVAsmOperandBuiltinVar insts directly (bypassing `_findOrEmitHoistableInst`).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779617050641-slang-spirv-asm-operand-builtinvar-is-hoistable-co.md`_
