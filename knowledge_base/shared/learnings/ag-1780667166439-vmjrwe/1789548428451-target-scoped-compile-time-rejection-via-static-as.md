---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789457074643-irsqov
written_at: 2026-09-16T08:47:08.451Z
---

# Target-scoped compile-time rejection via static_assert in a __target_switch arm (and its emit-ordering limit)

To make a core-module (`*.meta.slang`) compile-time rejection fire on **some targets but not others**, put the `static_assert` inside a specific `case X:` arm of a `__target_switch`:

```slang
__target_switch
{
case hlsl:
case spvDescriptorHeapEXT:
    static_assert(<cond>, "msg");   // fires only when compiling for hlsl or spvDescriptorHeapEXT
    break;
default:
    break;
}
```

Why it works: `specializeTargetSwitch` (link time, `slang-ir-specialize-target-switch.cpp`) selects the active target's arm and **dead-code-eliminates the rest**, and this runs *before* `checkStaticAssert` (`slang-emit.cpp:2129`). So a `static_assert` in a non-selected arm is deleted before it is ever checked. Verified live (built clean) + strong precedent: the `case hlsl:` texture-format asserts in `_Texture::SampleCmpLevel` (`hlsl.meta.slang:~1797`). Stacked case labels (`case hlsl: case spvDescriptorHeapEXT:`) share one arm body, so a test that exercises one label covers the other.

**Critical ordering limit — a static_assert CANNOT guard against a lowering-time ICE.** `checkStaticAssert` runs at `slang-emit.cpp:2129`, which is *after* the IR-lowering passes inside `linkAndOptimizeIR` (e.g. `lowerCombinedTextureSamplers` at `slang-emit.cpp:1913`). So if the offending construct makes a lowering pass ICE (`InternalError`) on a given target, adding a `case <that-target>:` static_assert does **nothing** — the ICE fires first, before the assert is ever checked. Before choosing "add a reject arm for target T", confirm T's path reaches emit-time without ICEing (targets that lower fine to a *valid-but-wrong-valued* shape, like HLSL/`spvDescriptorHeapEXT` for combined-sampler-from-heap, are catchable; targets that ICE in lowering, like WGSL for the same construct, are not — that's a separate lowering bug).

Context: shader-slang/slang#13085 / PR#13087 — scoping the single-index→combined-texture-sampler rejection to the targets that consume a separate sampler index (HLSL, `spvDescriptorHeapEXT`), leaving default SPIR-V/GLSL (native single-index combined) compiling. The guard must stay at the single-index `__init(UntypedResourceHandle)` producers, NOT in the shared `defaultGetDescriptorFromHandle`, because the explicit `.Handle(uint2(res,samp))` form also flows through the latter.
