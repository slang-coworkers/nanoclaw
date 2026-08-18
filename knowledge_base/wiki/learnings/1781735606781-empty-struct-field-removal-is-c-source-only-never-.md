---
title: "Empty-struct field removal is C-source-only — never run it on the direct-LLVM CPU path"
type: learning
topic: misc
source: learnings/1781735606781-empty-struct-field-removal-is-c-source-only-never-.md
---

# Empty-struct field removal is C-source-only — never run it on the direct-LLVM CPU path

**Context:** shader-slang/slang#8125 — an empty `struct` used as a struct member (e.g. a ParameterBlock element) is size-0 in layout/reflection but 1 byte as a **C/C++/CUDA source** member, so the following field is emitted past its reflected offset (CUDA_ERROR_ILLEGAL_ADDRESS / SIGSEGV). Fix = a new IR pass `removeEmptyStructFields` (source/slang/slang-ir-dce.cpp) that drops empty FIELDS and rewrites uses (FieldExtract→fresh MakeStruct, FieldAddress→fresh local Var).

**Rule:** scope such an empty-field-removal pass to the **C-like source** targets only — gate the call site with `&& !isCPUTargetViaLLVM(targetRequest)` (defined source/slang/slang-type-layout.cpp:3300). Do NOT run it for `!shouldLegalizeExistentialAndResourceTypes` alone, because that set also includes the **direct-LLVM CPU path** (HostLLVMIR/ShaderLLVMIR/HostObjectCode, or host-callable when EmitCPUMethod==via-LLVM).

**Why:** in LLVM IR an empty struct is a **zero-size** type that already matches reflection — so the bug doesn't exist there, the rewrite is unnecessary, AND the synthesized empty-struct insts (a 0-field `MakeStruct`, an empty-type `Var`) trip the LLVM emitter (internal assert at `slang-emit-llvm.cpp:2285 llvmInst`) on autodiff existential code. Concretely it broke `tests/autodiff/existential-1.slang.3 syn (llvm)` and `existential-specialized-1.slang.4 syn (llvm)` — both PASS on plain master, so the pass introduced the regression.

**Two traps this exposed:**
1. A peer reviewer (correct-looking) suggested moving the pass *after* the later unconditional `legalizeEmptyTypes` (the AD-2.0 one). That made it WORSE — it then mangles autodiff's own existential structs. Keep the pass right after the **CPU/CUDA-branch** `legalizeEmptyTypes` (before AD 2.0). AD 2.0 synthesizes differential/internal types, not empty fields in the user's public structs.
2. A reviewer flagged `FieldAddress`→`emitVar(fieldType)` as dropping the original address space and suggested preserving it. DECLINE: a fresh **local** allocation can't live in a buffer/uniform address space — matching it would be invalid IR — and for a no-byte empty value the AS is behaviorally immaterial. Plain `emitVar(fieldType)` (function-local) is correct.

**Process lesson:** a peer review that reads only the diff (correctness/clarity reviewers + an incomplete Devin) will NOT catch a runtime regression in an adjacent backend. ALWAYS run `tests/autodiff/` + the LLVM-CPU path in the regression set when touching a pass that runs on the CPU/CUDA emit path — the bug surfaced only in the `syn (llvm)` synthesized variants, which the targeted -cpu/-cuda test did not exercise. Establish the master baseline (run the failing tests with the pass absent) before assuming a failure is your regression vs pre-existing.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781735606781-empty-struct-field-removal-is-c-source-only-never-.md`_
