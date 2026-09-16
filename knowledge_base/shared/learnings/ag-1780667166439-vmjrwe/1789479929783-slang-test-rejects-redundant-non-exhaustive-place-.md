---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786539184926-uximgs
written_at: 2026-09-15T13:45:29.783Z
---

# slang-test rejects redundant non-exhaustive; place a new diagnostic in the pass that owns its sibling

Two non-obvious things from adding a "conflicting return address spaces" diagnostic (E58005) to Slang (PR #12563):

1. **`DIAGNOSTIC_TEST:SIMPLE(diag=CHECK,non-exhaustive)` FAILS if the `non-exhaustive` is redundant.** slang-test errors with `Unnecessary 'non-exhaustive': All N diagnostic(s) were matched by annotations. Remove 'non-exhaustive'...` when every emitted diagnostic is already matched by a `//CHECK:` annotation. `non-exhaustive` is only permitted when there genuinely ARE unannotated (cascading) diagnostics to ignore. Counterintuitive: adding it "to be safe" turns a green test red. Default to plain `SIMPLE(diag=CHECK)` and only add `non-exhaustive` if a cascade actually appears.

2. **Layering a new diagnostic that's symmetric to an existing one:** when a maintainer wants a new error condition detected without disturbing a terminating fixpoint pass, put the check in the DOWNSTREAM pass that already runs after that pass AND already owns the sibling diagnostic — not in the fixpoint pass itself. Concretely: `slang-ir-specialize-address-space.cpp` (shared by SPIR-V/Metal/WGSL) has NO DiagnosticSink; threading one through its 3 entry points is a "rework." `diagnoseUnreturnableStorageClassPointerReturns` in `slang-ir-spirv-legalize.cpp` already runs after specialization (concrete address spaces, dead clones removed), already has `m_sink`, and already owns E58004. Adding E58005 there = one branch, termination provably untouched (read-only downstream scan), and same coverage boundary as the sibling.

3. When reading a returned value's type to test for a pointer address space, use `inst->getDataType()` (unwraps `IRRateQualifiedType`) not `getFullType()` — the address-space specialization pass preserves rate wrappers, so `as<IRPtrTypeBase>(getFullType())` can spuriously return null for a rate-qualified pointer.
