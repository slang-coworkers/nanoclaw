---
title: "WGSL inout/out arg from global static → ptr address-space mismatch (legalizeCall skip-list gap)"
type: learning
topic: slang-compiler
source: learnings/1784636859545-wgsl-inout-out-arg-from-global-static-ptr-address-.md
---

# WGSL inout/out arg from global static → ptr address-space mismatch (legalizeCall skip-list gap)

**shader-slang/slang#12173** (triaged 2026-07-21 @HEAD 6a244fee2). WGSL emits invalid code when an `inout`/`out`-parameter function is called with a global `static` variable as the argument.

**Symptom:** `fn incV_0( v_0 : ptr<function, vec4<u32>>)` called as `incV_0(&(globalStatic_0))` where the global static is `var<private>` → passes `ptr<private,…>` into a `ptr<function,…>` parameter. naga/wgpu rejects it. Slang itself compiles fine; the bug is emit-only.

**Reproducible WITHOUT a GPU** — WGSL is a text-emission target; just `slangc -target wgsl …` and read the emitted text. (Contrast the Metal address-space family #11969/#11981/#8183, which are runtime crashes on `AddressSpace::Generic`.)

**Root cause (source-verified):** `legalizeCall` in `source/slang/slang-ir-wgsl-legalize.cpp:14-72` is the intended copy-in/copy-out bridge for by-ref args — it makes a `function`-address-space local (`emitVar(..., AddressSpace::Function)`), copies the arg in, passes the local, writes back after the call. BUT lines 46-55 unconditionally `continue` (skip the temp) for `kIROp_Var / kIROp_Param / kIROp_GlobalParam / kIROp_GlobalVar`. A global `static` is `kIROp_GlobalVar` (private a.s.), so it's skipped and passed directly. The skip-list keys on "is a whole addressable object" but ignores the **address-space** dimension. Skipping block-local `kIROp_Var` is correct (already `Function`); the bug is the global-scope entries.

**Pipeline ordering matters for the fix:** `legalizeIRForWGSL` (contains `legalizeCall`) runs at `slang-emit.cpp:2208`, BEFORE `specializeAddressSpaceForWGSL` at `:2441`. So at legalizeCall time the arg's concrete WGSL address space isn't assigned yet — a fix must discriminate on the arg's IR op/scope (global vs block-local `kIROp_Var`), which is what the skip-switch already does. `AddressSpace::Function` = SPIR-V Function; `AddressSpace::ThreadLocal(=1)` = SPIR-V Private = WGSL `private` (slang-type-system-shared.h:120).

**Recommended fix (Approach A):** narrow the skip-list so a global-scope pointer arg (not already function-space) flows through the existing temp path; keep block-local `kIROp_Var` skipped. Low-risk, WGSL-only, reuses the intended mechanism. Author's alternative (per-call-site function duplication per address space) avoids the copy but adds duplication the WGSL backend deliberately avoids.

**Test:** filecheck on emitted WGSL (no GPU) asserting the call passes a `ptr<function,…>` temp, not `&(global)`. Related: enabling WGPU testing for `tests/language-feature/scalar-ternary-op-short-and-non-short-circuit.slang` (PR #12163) once fixed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784636859545-wgsl-inout-out-arg-from-global-static-ptr-address-.md`_
