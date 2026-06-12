# shader-slang Sprint 54 — Todo / no-status items

- **Project:** [Slang-All](https://github.com/orgs/shader-slang/projects/10) view 23 ("Current Sprint")
- **Sprint 54:** 2026-05-12 → 2026-05-26 (today is 2026-05-21)
- **Filter:** `Sprint = Sprint 54` AND (`Status = Todo` OR `Status = (no status)`) AND open AND not archived
- **Total: 30 items** (16 Todo + 14 no-status)

## P0 (4)

- `slang#10267` — HLSL codegen emits `[raypayload]` without payload access qualifiers for SM 6.7+ — *(no status)* · @jkwak-work · https://github.com/shader-slang/slang/issues/10267
- `slang#10671` — `DescriptorHandle<RaytracingAccelerationStructure>` has potentially incorrect behavior with `spvDescriptorHeapEXT` — Todo · @jkwak-work · https://github.com/shader-slang/slang/issues/10671
- `slang#11004` — Internal error compiling `__fwd_diff` of an interface or generic-constrained method (`paramCount == callArgCount`) — *(no status)* · @saipraveenb25 · https://github.com/shader-slang/slang/issues/11004
- `slang#11036` — Setting `slang::CompilerOptionName::UseUpToDateBinaryModule` disallows loading binary modules — *(no status)* · @csyonghe, Copilot · https://github.com/shader-slang/slang/issues/11036

## P1 (8)

- `slang#9132` — Test slang-test with multiple CUDA versions — Todo · @jvepsalainen-nv · https://github.com/shader-slang/slang/issues/9132
- `slang#10747` — `[E30027]: 'GetTriangleVertexPositions' is not a member of 'HitObject'` — *(no status)* · @szihs · https://github.com/shader-slang/slang/issues/10747
- `slang#10957` — `loadModuleFromSource` can crash if used incorrectly — Todo · @jkwak-work · https://github.com/shader-slang/slang/issues/10957
- `slang#11002` — Upgrade DXC to preview 2605.2 (SM 6.10) and enable linalg tests on CI — Todo · @jkwak-work · https://github.com/shader-slang/slang/issues/11002
- `slang#11133` — Upgrade CMake workflow on github runner to use vs2026 — Todo · @jkwak-work · https://github.com/shader-slang/slang/issues/11133
- `slang#11144` — Allow manually triggering CI on draft PRs — Todo · @jkiviluoto-nv · https://github.com/shader-slang/slang/issues/11144
- `slang#11182` — Crash in `Slang::IRInst::getLastDecoration` — *(no status)* · @jkwak-work · https://github.com/shader-slang/slang/issues/11182
- `slangpy#950` — pip install from python 3.14 installs only v0.23.0 — Todo · @jkiviluoto-nv · https://github.com/shader-slang/slangpy/issues/950

## P2 (12)

- `shader-slang.github.io#122` — ReadTheDocs code colors do not react to dark mode properly — Todo · @aidanfnv · https://github.com/shader-slang/shader-slang.github.io/issues/122
- `slang#10212` — ICE 99999 "unimplemented: assignment" on `out`/`inout` parameters — *(no status)* · @jvepsalainen-nv · https://github.com/shader-slang/slang/issues/10212
- `slang#10774` — `IRBuilder::getSet()` segfault with RayQuery interface and generic ray traversal — *(no status)* · @saipraveenb25 · https://github.com/shader-slang/slang/issues/10774
- `slang#10802` — WGSL: Non-entrypoint struct not uniquely assigned location — *(no status)* · @aidanfnv · https://github.com/shader-slang/slang/issues/10802
- `slang#11083` — Make Fp16x2 atomics its own capability — Todo · @jkwak-work · https://github.com/shader-slang/slang/issues/11083
- `slang#11095` — error 39999: struct default-ctor synthesis fails when member type is defined later in file with explicit ctor — Todo · @jkwak-work · https://github.com/shader-slang/slang/issues/11095
- `slang#11096` — `uint16_t*` kernel arg generates SPIR-V with Capability `StoragePushConstant16` — *(no status)* · @tangent-vector · https://github.com/shader-slang/slang/issues/11096
- `slang#11161` — Add render-feature for blackwell-only tests — Todo · @kaizhangNV · https://github.com/shader-slang/slang/issues/11161
- `slang#11215` — test-server consumes unusually high amount of memory; probably leak — *(no status)* · @jkwak-work, @jkiviluoto-nv · https://github.com/shader-slang/slang/issues/11215
- `slangpy#806` — Optimize generated kernel: eliminate trampoline overhead for 1:1 tensor-to-thread — Todo · @szihs · https://github.com/shader-slang/slangpy/issues/806
- `slangpy#807` — Support 0-dimensional kernel dispatch with explicit thread count — Todo · @szihs · https://github.com/shader-slang/slangpy/issues/807
- `slangpy#808` — CUDA backend lacks format conversion for surface/texture writes — Todo · @szihs · https://github.com/shader-slang/slangpy/issues/808

## P3 (1)

- `slang#6216` — Out-of-order constant buffer declaration outputs wrong bindings with `vk::location` (HLSL→GLSL) — Todo · @zangold-nv · https://github.com/shader-slang/slang/issues/6216

## No priority (5)

- `slang#9692` — Automate SPIRV-Tools update process — Todo · @jvepsalainen-nv · https://github.com/shader-slang/slang/issues/9692
- `slang#11160` — slangc crash with mixed `fwd_diff` and `bwd_diff` — *(no status)* · @saipraveenb25 · https://github.com/shader-slang/slang/issues/11160
- `slang#11197` — Slang does not accept `SV_PrimitiveID` as input to intersection shaders — *(no status)* · @jkwak-work · https://github.com/shader-slang/slang/issues/11197
- `slang#11201` — Slang lexer/parser accepts bogus integer literal suffixes — *(no status)* · @skiminki-nv · https://github.com/shader-slang/slang/issues/11201
- `slang#11216` — Integer literal type corner-case handling should be defined — *(no status)* · @skiminki-nv · https://github.com/shader-slang/slang/issues/11216

## Distribution

- **By repo:** slang ×25 · slangpy ×4 · shader-slang.github.io ×1
- **Top assignees:** jkwak-work (10), szihs (4), saipraveenb25 (3), jvepsalainen-nv (3), jkiviluoto-nv (3), skiminki-nv (2), aidanfnv (2)
