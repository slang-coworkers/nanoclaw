---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787690935029-uubwb9
written_at: 2026-08-25T23:02:08.314Z
---

# E36108/E36110 interface-conformance false positive: target-agnostic inferred caps treated as impl contract

slang#12755 family. A `public struct` implementing a `public interface` whose method body calls a portable stdlib fn (e.g. `normalize`) can spuriously fail interface conformance with E36110 ("capability incompatible with interface — uses capability 'cuda_sm_2_0'") or the sibling E36108 ("dependencies not compatible on target 'llvm'"), even for a `-target hlsl` compile.

ROOT CAUSE (source-verified on master 8fe3df827): The witness-table interface-requirement check in `SemanticsDeclCapabilityVisitor::visitInheritanceDecl` (slang-check-decl.cpp ~21168) runs `checkCapabilityRequirement(MustHaveEqualAbstractAtoms, available=requirement.inferred, required=impl.inferred)`. The front-end capability visitor is TARGET-AGNOSTIC (no CodeGenTarget; `_propagateRequirement` only joins, never intersects with the compile target). So a public impl method with NO explicit `[require]` inherits `normalize`'s full `[require(cpp_cuda_glsl_hlsl_metal_spirv_wgsl_llvm, sm_4_0_version)]` set (8 targets, incl. cuda's `cuda_sm_2_0`). `MustHaveEqualAbstractAtoms` then rejects the impl for supporting MORE targets/sub-caps than the requirement declares.

KEY DISTINCTIONS that took experiments to establish (use the prebuilt `/workspace/agent/slang/build/Debug/bin/slangc` to reproduce on master with a hand-written public interface — the RT module is NOT needed):
- E36108 vs E36110 is the SAME defect: E36108 fires when the impl has extra bare TARGET atoms (count short-circuit, slang-capability.cpp:1459-1477); E36110 fires when the impl needs an extra SUB-CAP within a target the requirement shares (per-stage loop, :1537 `availableStageSet.contains`). Same `diagnoseUndeclaredCapability`, routed by `hasTargetAtom`.
- INTERNAL (non-public) impls compile fine — they take the JOIN path and the witness gate at 21162 requires an ExplicitlyDeclaredCapabilityModifier which they lack.
- The sibling PUBLIC SELF-CHECK (slang-check-decl.cpp:20996) uses `AvailableCanHaveSubsetOfAbstractAtoms` and permits an impl to support MORE whole targets, but STILL errors on an extra sub-cap WITHIN a declared target (e.g. sm_6_6 within hlsl). So "impl may support more" is about extra TARGETS, not extra versions.
- `isTargetVersionAtom` (slang-capability.cpp:167) covers spirv/metal/hlsl/glsl families but OMITS cuda SM atoms — a version-vs-feature cut is UNSOUND.

FIX SHAPE (scoped hybrid, kept local to the witness-table path): explicit-`[require]` impls keep MustHaveEqualAbstractAtoms; inferred-only impls are checked with `AvailableCanHaveSubsetOfAbstractAtoms` against the requirement PROJECTED to the requested compile targets (drop non-requested target branches by removing keys from `getCapabilityTargetSets()`, keeping full stage/version atoms of retained branches). Fall back to strict when there are no concrete requested targets (module precompile / language server SLANG_TARGET_UNKNOWN — `slang-workspace-version.cpp` creates a profile-only target whose getCompileTarget() is arbitrary). This preserves capability2.slang (feature within shared spirv target) and the version-escalation contract (docs/user-guide/05-capabilities.md:204-257).
