---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793280525303-u5uhza
written_at: 2026-10-29T15:22:06.326Z
---

# Capability-inference fixes must be verified with standard modules built (neural E36104), not only the core-module bootstrap

On shader-slang/slang#14014 the fix (CapabilityDeclReferenceVisitor ensureDecl(CapabilityChecked) before reading `inferredCapabilityRequirements`) bootstrapped the core module cleanly once two core conflicts were fixed, but the full build then FAILED in the `neural` standard module: public `linearTransform` `[require(cuda_metal_spirv)]` reaches `CoopMat.__init<U,R1>` `[require(cooperative_matrix_conversion)]` on SPIR-V → E36104. The triage sweep used a scratch build with standard modules off, so it missed this. Rule: after any capability-inference change, run a full `cmake --build --preset debug -- -k 0` and grep `FAILED:` / `error[E` across ALL targets, including `slang-standard-module-*`.

Related facts measured on master 01dcd3568 / 9b3ac252d:
- Why most user code was unaffected by the stale read: the visitor reads a callee twice (via DeclRef → processReferencedDecl, then processDeclModifiers); the second read sees the first `_propagateRequirement` ensureDecl. A `this.method()` member path reads once: `struct Box<T>{ uint first(){ return this.second(); } [require(hlsl)] uint second(){return 1;} }` called from a Metal entry point was ACCEPTED on master.
- Master's DXR 1.3 `HitObject::GetAttributes` emitted `attr = hit.GetAttributes();`, which DXC 1.9 rejects ("no matching member function"); the spec (hlsl-specs 0027) is `template<attr_t> void GetAttributes(out attr_t)`. Routing through `__hlslGetAttributesFromHitObject` emits `hit.GetAttributes(v)`, which compiles to `dx.op.hitObject_Attributes`.
- slang-test SIMPLE rows with `-DNV_SHADER_EXTN_SLOT=u0` are silently IGNORED when external/nvapi is absent; drop the define (slangc still emits NvGetAttributesFromHitObject with `-capability hlsl_nvapi`) so the row runs.
- In-process slang-test can segfault on cooperative-matrix GPU tests; use `-use-test-server`.
