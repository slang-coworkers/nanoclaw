---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788393407820-k5x3dg
written_at: 2026-09-03T00:08:17.476Z
---

# Metal DispatchMesh legalization: intrinsic-asm operand-vs-name threading, and virtual-dispatch target gating

Investigated for PR #12887 (Metal DispatchMesh in a helper / >1 call). Two reusable facts:

**1. `__intrinsic_asm` string substitution — operand vs bare name.** In `slang-intrinsic-expand.cpp`, `$0..$N` are substituted positionally with the IR call's *operands* (`_emitSpecial`, ~:356-380); bare identifiers in the asm string are emitted **verbatim as source text** (span flush, ~:124-145). So a value can be threaded into an intrinsic ONLY by making it one of the call's `$`-operands. Bare C identifiers (e.g. Metal's `_slang_mesh_payload`, `_slang_mgp` in `hlsl.meta.slang` DispatchMesh) require that exact name to be **in lexical scope at the emit site**. Those names resolve because synthesized `IRParam`s carry `IRExternCppDecoration("<name>")`, which forces the emitted identifier to that literal string (`slang-emit-c-like.cpp:1251-1255`). Consequence: an intrinsic that references entry-point params by textual name has a hard precondition that the call sits inside that entry-point function — hence the PR inlines helpers containing the call. "There is no IR form to thread" is the wrong framing (the params ARE IRParams); the real obstacle is "no operand slot on the intrinsic + the object is a target-ABI entry-point object, not a user value."

**2. Amplification legalization is Metal-only via VIRTUAL DISPATCH, not a call-site `if`.** `legalizeEntryPoint` dispatches on *stage* only (`slang-ir-legalize-varying-params.cpp:4127-4137`). `legalizeAmplificationStageEntryPoint` is a `virtual` on base `LegalizeShaderEntryPointContext` whose base body is an empty no-op (`:2779-2782`). Only `LegalizeMetalEntryPointContext` (`:4141`) overrides it (`:4579`); `LegalizeWGSLEntryPointContext` (`:4826`) does not (inherits no-op); CPU/CUDA use separate free functions. So a "generic"-named legalization fn can be effectively single-target — check for a per-target subclass override before assuming it runs everywhere.

**3. Standard Slang mechanism for exposing an entry-point value to a helper:** either thread it as an ordinary IRCall operand, OR inline the helper (`performForceInlining` runs pre-emit and inlines ref/borrow-param + `[ForceInline]` fns: `slang-emit.cpp:1786/1821/2647`, `slang-ir-inline.cpp:1051-1122`). Inlining-to-bring-a-value-into-scope is thus an established pattern, not a hack. Contrast: mesh-stage payload is a real source `in payload T` param, so `legalizeMeshStageEntryPoint` retypes it in place (no inlining); amplification has no such source param, so it synthesizes.
