---
title: "Autodiff canTypeBeStored allowlist doesn't recurse — resource-bearing struct/interface gets checkpointed → invalid SPIR-V pointer Var (slang#13250, #9062 family)"
type: learning
topic: slang-compiler
source: learnings/1790223013039-autodiff-cantypebestored-allowlist-doesn-t-recurse.md
---

# Autodiff canTypeBeStored allowlist doesn't recurse — resource-bearing struct/interface gets checkpointed → invalid SPIR-V pointer Var (slang#13250, #9062 family)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790221680549-6w50h5
written_at: 2026-09-24T04:10:13.039Z
---

# Autodiff canTypeBeStored allowlist doesn't recurse — resource-bearing struct/interface gets checkpointed → invalid SPIR-V pointer Var (slang#13250, #9062 family)

**Symptom:** reverse-mode (`bwd_diff`) shader compiles rc=0 but spirv-val rejects a `Function`-storage `OpVariable` whose pointee is a logical pointer to a resource (e.g. `_ptr_Function__ptr_Uniform_RWStructuredBuffer`) — "In Logical addressing, variables may not allocate a pointer type." Reproduce GPU-free with `-target spirv-asm` (logical-ptr slots only survive at -O0/-g; optimized runs promote them and pass by luck).

**Root-cause locus (source-verified @ HEAD 6eb89786c):** the reverse-mode checkpoint policy stores a *resource-bearing* value into the backward-pass intermediate/params context. `canTypeBeStored` (`source/slang/slang-ir-autodiff.cpp:993-1035`) is an ALLOWLIST that returns `true` unconditionally for `kIROp_StructType`/`kIROp_InterfaceType`/`kIROp_AnyValueType` **without recursing into field/element types** (it already recurses for `TupleType` :1023-1031 and `AttributedType` :1021 — the aggregate cases were missed). A bare resource handle is never stored directly (falls to `default: return false`), but a struct (or an existential) that *contains* `StructuredBuffer`/`RWByteAddressBuffer`/`RWStructuredBuffer` fields is deemed storable. Decision path: `DefaultCheckpointPolicy::classify` (`slang-ir-autodiff-primal-hoist.cpp:2883`) → `shouldStoreInst`/`shouldStoreVar`/`canRecompute`, all gated on `canTypeBeStored`; a first-block interface param (`weights: ITensor`) is stored because `canRecompute` returns false for it (`:2864-2871`, fallback stores `:2905-2909`). The captured resource then materializes as a pointer-typed `Function` Var that SSA-promotion rejects (its address is read back across the loop's control flow, `slang-ir-ssa.cpp:478-573`) and `emitVar` (`slang-emit-spirv.cpp:8200-8212`) emits verbatim — no guard, no diagnostic. `reconcilePointerSlots` (`slang-ir-specialize-address-space.cpp:494-628`) only retypes the slot's address space, never scalarizes it.

**Principled fix (producer-side):** recurse `canTypeBeStored` into aggregate/interface members and refuse to checkpoint any type transitively containing an opaque resource or a non-`UserPointer` (logical) pointer → those primal values recompute instead (recomputing a read-only resource-handle load is cheap and side-effect-free). ⚠ **Subtlety:** when the value arrives as an interface EXISTENTIAL, the concrete resource is not visible to `canTypeBeStored` until after specialization/monomorphization — the check likely must run on the specialized IR (or conservatively refuse to checkpoint a resource-backable existential). Defense-in-depth: a SPIR-V-legalization scalarization or, minimally, a fail-loud diagnostic at `emitVar` so this shape never emits silently-invalid SPIR-V (also backstops the non-autodiff variant #13206). `VariablePointers` does NOT lift this rule (only the OpFunctionCall memory-object restriction).

**Family:** same root class as #9062 (autodiff array-of-logical-resource-pointers via `IDifferentiablePtrType`); one producer-side fix likely covers both. Related: #6700 (closed, same OpVariable validation class, non-autodiff), #13206/#13039 (logical-pointer-in-composite legalization gap).

**Aside:** this repro also compiled >10 min fully CPU-bound on a Release binary — consistent with the known super-linear autodiff compile-time class (#13010), orthogonal to the correctness bug.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790223013039-autodiff-cantypebestored-allowlist-doesn-t-recurse.md`_
