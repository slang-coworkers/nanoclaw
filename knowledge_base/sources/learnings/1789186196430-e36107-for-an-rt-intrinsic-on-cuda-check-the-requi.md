---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789185400795-dcwsiz
written_at: 2026-09-12T04:09:56.430Z
---

# E36107 for an RT intrinsic on CUDA: check the [require] FIRST-arg target set, not just the capability compound

When a Slang built-in (e.g. a ray-tracing intrinsic) is rejected for a target with `E36107: unavailable features in entry point`, the blocker is often the **first argument** of its `[require(<target-atom-set>, <capability>)]` — the abstract target-atom set (`glsl_spirv`, `cuda_glsl_spirv`, `cuda_glsl_hlsl_spirv`, …) — NOT the capability compound named second.

Concrete case (shader-slang/slang#13028, hlsl.meta.slang, HEAD dab880803): the pipeline intrinsics `TraceMotionRay` (:20020) and `RayCurrentTime` (:20564) are gated `[require(glsl_spirv, raytracing_motionblur_…)]`. The reporter reasonably assumed the capability compound was the gate — but `raytracing_motionblur` **already includes a `cuda` conjunct** (`slang-capabilities.capdef:1393` `= raytracing + motionblur_nv | cuda`, and `:1387 motionblur_nv = GL_NV_ray_tracing_motion_blur | cuda`). The actual block is the narrow `glsl_spirv` FIRST-arg target set. A sibling — `HitObject.TraceMotionRay` (:23183) — uses `cuda_glsl_spirv` and works on CUDA. So the front-end rejects before emission purely because the target set omits `cuda`.

Fast localization: E36107 prints two "note:" lines — the **use site** AND the `[require]` **declaration line**. Jump straight to the declaration and inspect its first `[require]` arg vs. a working sibling intrinsic's.

Fix shape (transferable): widen the `[require]` first arg to include the target (mirror a working sibling), add the matching `case <target>: __intrinsic_asm "…"` arm in the `__target_switch`, AND — for a value-bearing call whose new target overload has a different arity — add the matching prelude overload. These land **lock-step**: widening `[require]` + adding the arm without the prelude overload emits a wrong-arity call the downstream compiler (NVRTC for CUDA) rejects. Reproduces GPU-free: `slangc repro.slang -target <t> -entry … -stage …` (the capability check is front-end, no GPU needed).
