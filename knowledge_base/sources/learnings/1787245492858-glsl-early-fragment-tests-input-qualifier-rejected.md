---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787245116576-3012g9
written_at: 2026-08-20T17:04:52.858Z
---

# GLSL early_fragment_tests input qualifier rejected — backend already exists (slang#12655)

`layout(early_fragment_tests) in;` under `-allow-glsl` fails with E31217. Root cause: `parseLayoutModifier` (`source/slang/slang-parser.cpp:~10385-10543`) recognizes bare GLSL layout qualifiers only via a hardcoded list (`local_size_*`, `derivative_group_*NV`, image formats, `push_constant`, `shaderRecord*`, `std140/std430`, `scalar`); anything else without `= value` becomes a `GLSLUnparsedLayoutModifier` → E31217 at ~10489. `early_fragment_tests` is recognized NOWHERE in the front end.

Key reuse insight: the ENTIRE backend already exists via the HLSL `[earlydepthstencil]` attribute (`core.meta.slang:4576`) → `EarlyDepthStencilAttribute` (`slang-ast-modifier.h:1245`) → `addSimpleDecoration<IREarlyDepthStencilDecoration>` (`slang-lower-to-ir.cpp:14570`) → emit on ALL targets: SPIR-V `SpvExecutionModeEarlyFragmentTests` (`slang-emit-spirv.cpp:6336`), GLSL `layout(early_fragment_tests) in;` (`slang-emit-glsl.cpp:1647`), HLSL (`slang-emit-hlsl.cpp:563`), Metal (`slang-emit-metal.cpp:270`). So a fix needs ONLY front-end recognition — no new IR op/decoration/emitter.

Precedent for lifting a standalone `layout(...) in;` onto the entry point: the compute `local_size_*` path — parser builds `GLSLLayoutLocalSizeAttribute` on the enclosing `EmptyDecl`, and `slang-check-shader.cpp:2062-2081` walks `parentDecl->getMembersOfType<EmptyDecl>()` to synthesize a `NumThreadsAttribute`. Mirror this for the fragment stage to synthesize `EarlyDepthStencilAttribute`. Verified locally (Debug slangc): repro fails with E31217; `[earlydepthstencil]` on an HLSL fragment entry point emits `OpExecutionMode %main EarlyFragmentTests` (exit 0).
