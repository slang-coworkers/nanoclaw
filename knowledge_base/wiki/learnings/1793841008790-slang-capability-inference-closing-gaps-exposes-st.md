---
title: "Slang capability inference: closing gaps exposes stale [require]s — struct fields at use sites OK; initializers / MemberDeclRef members are not"
type: learning
topic: slang-compiler
source: learnings/1793841008790-slang-capability-inference-closing-gaps-exposes-st.md
---

# Slang capability inference: closing gaps exposes stale [require]s — struct fields at use sites OK; initializers / MemberDeclRef members are not

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793811654478-vr0qdh
written_at: 2026-11-05T01:10:08.790Z
---

# Slang capability inference: closing gaps exposes stale [require]s — struct fields at use sites OK; initializers / MemberDeclRef members are not

From #10232 / PR #14332 (gating `double` behind a new `fp64` capability):
- **Struct fields:** join a struct's instance-field requirements where the struct is *used* (`CapabilityDeclReferenceVisitor::processReferencedDecl`, including the inner struct of a `GenericDecl`, base structs, and `MemberDeclRef` structs). Do not join them into the struct's own `inferredCapabilityRequirements`: `getDeclaredCapabilitySet` treats that set as the declared set of the struct's methods, so a method calling `min` hits E36104. That E36104 is exactly the failure core `double.__min` showed.
- **Initializers:** making `checkVarDeclCommon` visit global/static initializers rejected valid code that master compiles. It broke tests/bugs/13074/* (HLSL `&` in a static resource initializer) and static-const-struct-array-resource-13107 (CUDA `DescriptorHandle.init`). Revert it; it needs its own design.
- **MemberDeclRef:** processing a `MemberDeclRef` member's *own* requirements broke the core module build (E36104 `coopVecLoad` vs `CoopVec.load` / optix_coopvec). Only field requirements are safe to join there.
- **Default arguments:** visit a parameter's `initExpr` at each call that omits it (lowering inserts the default at the call). Keep a per-walk visited set of parameters: a recursive struct's synthesized constructor has a default that calls itself, and without the set it recursed until SIGSEGV (recursive-variadic-field-specialization-budget.slang). The crash only showed under the test server.
- **Link-time `-conformance` types:** no capability is checked for them at all, even an explicit `[require(hlsl)]` on wgsl/metal/spirv.
- **Preprocessor:** Slang `-DFOO` without a value defines an EMPTY macro, so `#if FOO` gives E15201. Use `-DFOO=1` or `#ifdef`.
- **Verification:** run a compile-only sweep of every WGSL/Metal `//TEST` line, master vs fix (889 configs). wgpu and metal runtime tests are ignored on Linux, so the sweep is the real signal for those targets.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793841008790-slang-capability-inference-closing-gaps-exposes-st.md`_
