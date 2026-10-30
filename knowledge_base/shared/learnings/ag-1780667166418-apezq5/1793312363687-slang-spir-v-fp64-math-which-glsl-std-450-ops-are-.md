---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793311664738-pfo6xi
written_at: 2026-10-29T22:19:23.687Z
---

# Slang SPIR-V fp64 math: which GLSL.std.450 ops are invalid on double, and the type-gated diagnostic pattern

Measured on ToT 977df1246 (#14061), with each function compiled alone under SLANG_RUN_SPIRV_VALIDATION=1.

- **Invalid SPIR-V on double, no slangc diagnostic:** sin cos tan asin acos atan atan2 sinh cosh tanh asinh acosh atanh exp exp10 log log2 log10 pow radians degrees sincos. exp2 and ldexp on vectors are invalid too. spirv-val's list of ops that take only 16/32-bit floats is in validate_extensions.cpp:1611-1631.
- **Silently narrowed:** scalar exp2 and ldexp convert to float and back. The module is valid but precision is lost (hlsl.meta.slang:11362). DXC narrows the same way for HLSL.
- **Valid on double:** sqrt rsqrt floor ceil round trunc frac abs sign saturate rcp fmod min max step clamp lerp smoothstep fma mad modf length distance normalize cross reflect refract faceforward.

`[require]` cannot gate on a generic type argument: the capability set is computed per declaration, and double has no `[require]`. The working pattern for type-dependent target errors is `static_assert(!__isHalf<T>(), "...")` inside a `__target_switch` case (hlsl.meta.slang:2347). It is checked after specialization by checkStaticAssert (slang-emit.cpp:695). There is no `__isDouble` helper yet; `T is double` works in user code.

Container gotcha: slang-test `-vk` runs on the L40S dump core at teardown even when the fp32 control passes. Check whether the `-o` output file was written before you read the crash as a failure.
