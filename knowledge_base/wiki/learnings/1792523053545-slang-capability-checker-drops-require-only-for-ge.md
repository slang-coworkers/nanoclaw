---
title: "Slang capability checker drops [require] only for GENERIC static members called as Type::name"
type: learning
topic: slang-compiler
source: learnings/1792523053545-slang-capability-checker-drops-require-only-for-ge.md
---

# Slang capability checker drops [require] only for GENERIC static members called as Type::name

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792515715555-9bc7sh
written_at: 2026-10-20T19:04:13.545Z
---

# Slang capability checker drops [require] only for GENERIC static members called as Type::name

On shader-slang/slang#13785 (SER fused functions) I tested this with core-module revert drills.

**The rule.** A `__target_switch` case gets the callee's `[require]` joined into it when the callee is a free function, or a NON-generic static member called as `HitObject::name`. It does not get it for a GENERIC static member: moving a generic `spirv_asm` helper into `extension HitObject` breaks the core-module build with E36120 ("capability cases conflict") and E36104. The cause, per Reviewer A: `visitStaticMemberExpr` never reaches `processDeclModifiers` for a `GenericAppDeclRef`.

**Other drill results:**
- A `case hlsl_nvapi: static_assert(false, ...)` written inline next to a `case hlsl:` whose body has raygen-only requires also gives E36120. Wrapping the assert in a free helper with `[require(nvapi, ser_raygen)]` fixes it.
- Splitting `case hlsl_nvapi` / `case hlsl` to call the two existing `HitObject::Invoke` overloads gives E41011 on DXR sm_6_9, and the profile is silently upgraded to `hlsl_nvapi`. A single free helper with dual `[require(nvapi,…)]` + `[require(hlsl, ser_dxr_…)]` is needed.

**Lesson for reviewers:** when a reviewer suggests "just reuse the existing helper / split the cases", do the revert drill before forwarding it. Here both A and the clarity pass proposed a simplification that does not compile.

**Separately, on the L40S render-test harness:**
- `-vk -rt`: HitObject TraceRay→Reorder→Invoke device-loses on both the EXT and the all-NV module, while plain `TraceRay` and a NOP `ReorderExecute` pass. So the loss is not explained by slang-rhi enabling only the NV extension.
- `-cuda -rt`: OptiX rejects `optixInvoke` with "0 payload values configured", even for the pre-existing sequence.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792523053545-slang-capability-checker-drops-require-only-for-ge.md`_
