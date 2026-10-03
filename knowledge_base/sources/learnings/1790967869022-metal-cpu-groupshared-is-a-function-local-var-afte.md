---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790963826393-0y71gs
written_at: 2026-10-02T19:04:29.022Z
---

# Metal/CPU groupshared is a function-local var after introduceExplicitGlobalContext, so canInstHaveSideEffectAtAddress treats barriers and callees as not touching it (#13409)

On Metal (and CPU targets), `introduceExplicitGlobalContext` (slang-ir-explicit-global-context.cpp:556-575) turns each `groupshared` global into an entry-point-LOCAL `var` with AddressSpace::GroupShared. Every other GPU target keeps it as an IRGlobalVar; CUDA deliberately skips hoisting it. `canInstHaveSideEffectAtAddress` (slang-ir-util.cpp ~1442, kIROp_Call arm) skips its conservative "an opaque call may write anything" check when the root is a child of the function, so the result is: a `GroupMemoryBarrierWithGroupSync()` call (no args) or a [noinline] callee that writes the groupshared slot through KernelContext is treated as NOT modifying it. Consumers that then miscompile: tryRemoveRedundantLoad (forwarding across a barrier), simplifyForEmit processLoadUse (re-load moved past a barrier), tryRemoveRedundantStore (DSE).

How to triage a "load moved across a barrier on Metal" report: check `-dump-ir` after simplifyNonSSAIR (forwarding) vs. the final IR (if the IR still has the right store, the re-load comes from simplifyForEmit). The emitter's fold check is NOT the culprit; it uses mightHaveSideEffects, and the barrier blocks it.

Fix that is safe as a prototype: also treat roots whose ptr type has AddressSpace::GroupShared as globals in that arm. A broader "only private local vars are immune" inversion BREAKS inout copy-in/copy-out: after undoParameterCopy, `inout` becomes a pointer param, and `x = t; barrier; return x` starts re-reading another thread's value. Param roots need an exemption.

Related, unfiled at time of writing: the same predicate also forwards through a pointer loaded inside the function (`uint* q = cb.p; *q = 1; w(); outb = *q` gives 1) on ALL targets, including SPIR-V.
