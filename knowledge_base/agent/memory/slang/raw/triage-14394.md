---
type: triage
title: "shader-slang/slang#14394 — [Metal] ParameterBlock unexpected output"
description: Working as designed — Metal lowers ParameterBlock to an argument buffer (documented); no flatten option exists. Workaround for SDL3 flat argument tables = plain global struct (or ConstantBuffer<T>) with layout(set=N). Optional opt-in flatten = maintainer feature decision.
tags: [metal, parameter-block, argument-buffer, sdl3, question, parked]
---
# Triage: shader-slang/slang#14394 — [Metal] ParameterBlock unexpected output
Date: 2026-11-07 | question (working as designed; latent feature request) | low | P3 | target-emit (Metal) / layout | Duplicate: no

## What's broken / being requested
Reporter rope-hmg (external, NONE) wants `layout(set = 2) ParameterBlock<Test> test` (Test = {SamplerState, Texture2D})
to emit the same Metal entry params as two explicit globals: `[[texture(0)]]` + `[[sampler(0)]]`. Instead Metal emits
`Test_default_0 constant* test_0 [[buffer(0)]]` (argument buffer). Goal: SDL3 GPU layout (SDL_CreateGPUShader). SDL3's MSL
rules are flat *argument tables* — sampled textures first in `[[texture]]`, samplers in the same order in `[[sampler]]`,
uniform buffers first in `[[buffer]]` then storage buffers; argument buffers are not mentioned. SPIR-V: fragment set 2 =
resources, set 3 = uniforms (vertex: 0/1). GLSL/WGSL ParameterBlock already gives set/group 2 for them.

## Repro (FACT — local master build, checkout ae4e57957, Release slangc built 2026-11-06 23:09Z; matches reporter's 2026.21 output byte-for-byte in the shown region)
`slangc b.slang -target metal -entry frag_main -stage fragment` (scratch /tmp/t14394/{a..q}.slang)
- (a) explicit globals → `texture2d … texture_1 [[texture(0)]], sampler sampler_1 [[sampler(0)]]`.
- (b) ParameterBlock → `Test_default_0 constant* test_0 [[buffer(0)]]`. SPIR-V: set 2 bindings 0/1; WGSL @group(2) 0/1.
- Workarounds verified on metal + spirv-asm + wgsl (all give Metal flat `[[sampler(0)]]`/`[[texture(0)]]`, Vulkan set 2 b0/b1, WGSL @group(2)):
  `layout(set = 2) ConstantBuffer<Test> test;`, `[[vk::binding(0, 2)]] ConstantBuffer<Test> test;`,
  `[[vk::binding(0, 2)]] Test test;`, `layout(set = 2, binding = 0) Test test;`.
- `Test test : register(space2);` alone → E39029 warning and Vulkan set 0 (space→set not mapped without vk binding/shift).
  `ConstantBuffer<Test> test : register(space2)` → E31222.
- SDL3-shaped multi-resource check (n.slang: 2 tex, 2 samplers, 1 RWTexture in set 2 + `layout(set=3) ConstantBuffer<Uniforms> u`):
  textures 0,1, storage tex 2, samplers 0,1 — matches SDL3 ordering. **Wrinkle (FACT):** with `ConstantBuffer<Test>`,
  `u` lands at `[[buffer(1)]]` on Metal (reflection: test=constantBuffer 0, u=1) — the resource-only cbuffer reserves
  `[[buffer(0)]]` though nothing is emitted for it. HLSL gives `u` b0. With the plain global struct form (o.slang) or an
  explicit `register(b0)` on `u` (p.slang), `u` is `[[buffer(0)]]`. → recommend the plain global struct form.

## Codebase digest (FACT, file:line @ae4e57957)
- Docs: `docs/user-guide/a2-02-metal-target-specific.md:198-229` "Parameter blocks and Argument Buffers" — "`ParameterBlock`
  values are translated into _Argument Buffers_ potentially containing nested resources", example `MyParameters constant* gObj [[buffer(1)]]`.
  `:350-356` `register()` respected; "`spaceN` specifiers inside `register` semantics are ignored."
- `source/slang/slang-emit.cpp:2064-2079` — Metal-only `lowerBufferElementTypeToStorageType` with policy `MetalParameterBlock`
  (comment: "legalize constant buffer types as if it is a bindful target, and skip legalizing parameter block types as if
  it is a bindless target"). Resource fields → DescriptorHandle (`slang-ir-lower-buffer-element-type.cpp:~3383-3410`).
- `source/slang/slang-legalize-types.cpp:~1308-1318` — Metal skips legalizing the ParameterBlock element type; ConstantBuffer is
  legalized (resources split out), `:~1296-1297`.
- `source/slang/slang-type-layout.cpp:3637` `shouldAllocateRegisterSpaceForParameterBlock` (sets only for VK/WGPU/D3D12);
  `:4056-4059` `wantConstantBuffer` always true on Metal (also CUDA/CPU) → the reserved-buffer wrinkle above.
  `getParameterBlockRules` `:~2804` → Metal argument-buffer element rules (tier-1 `[[id]]` slots); tier-2 rules only via the
  reflection API `SLANG_LAYOUT_RULES_METAL_ARGUMENT_BUFFER_TIER_2` (`include/slang.h:~2448`) — reflection only, not codegen.
- Emit: `slang-emit-metal.cpp:~1343-1348` ParameterBlock/ConstantBuffer → `T constant*`; `[[buffer(N)]]` from `emitFuncParamLayoutImpl` `:~184-196`.
- Options: none in `slang-options.cpp` / `CompilerOptionName` to flatten ParameterBlock or pick an AB tier (FACT, grep + DeepWiki agree).
- Tests: `tests/metal/parameter-block.slang`, `vector-argument-buffer-layout.slang`, `nested-parameter-block-reflection.slang`,
  `sampler-array.slang` pin the argument-buffer contract; `tests/metal/texture-binding-index.slang` pins flat globals.

## Candidate approaches
### Approach A: Answer + workaround; optional one-paragraph docs note (no compiler change)
- Where: issue comment; optionally `docs/user-guide/a2-02-metal-target-specific.md` after :229 ("to get flat
  `[[texture]]/[[sampler]]/[[buffer]]` argument tables, declare the struct as a plain global or `ConstantBuffer<T>`").
- Delta: none in codegen. Tradeoffs: zero risk; the reporter is unblocked today. Risk: none.
### Approach B: Opt-in option to lower ParameterBlock like ConstantBuffer on Metal (flat argument tables)
- Where: new `CompilerOptionName` (append-only, `include/slang.h`) + `slang-options.cpp`; gate the MetalParameterBlock pass
  (`slang-emit.cpp:2064`), the element-type skip (`slang-legalize-types.cpp:~1308`), and `getParameterBlockRules` /
  `wantConstantBuffer` in BOTH `slang-type-layout.cpp` (reflection) and `slang-ir-layout.cpp` (emit) so reflection stays in step.
- Delta: ParameterBlock<T> on Metal → per-resource `[[texture(N)]]`/`[[sampler(N)]]`/`[[buffer(N)]]` + uniform `[[buffer(N)]]`.
- Tradeoffs: lets portable ParameterBlock code target SDL3-style hosts; but a second Metal layout mode doubles test surface,
  and nested ParameterBlock / resource arrays / bindless (DescriptorHandle) inside blocks have no flat equivalent (must diagnose).
- Risk: medium — reflection/emit drift (cf. #14042, #13900 history). Must be opt-in; the default is a tested, documented contract.
### Approach C: Per-declaration attribute (e.g. `[[metal::flatten]]` / honour `layout(set)` as "no AB")
- Same plumbing as B but per variable; more granular, more language surface. Risk: medium-high; needs language design.
### Rejected: change the default
- Breaks every Metal host that binds ParameterBlocks as argument buffers and the four tests above. Not a bug fix.

## Recommended path
**A** — not a bug; working as designed and documented. Reply with the plain-global-struct workaround
(`layout(set = 2, binding = 0) Test test;` / `[[vk::binding(0, 2)]] Test test;`), verified on metal/spirv/wgsl. No fixer
handoff. Park B/C as a feature decision for the Metal backend maintainers (jhelferty-nv per #10842 / #13900 history); hand
off only if a maintainer asks for the opt-in. Acceptance for B if requested: option off → all `tests/metal/*parameter-block*`
unchanged; option on → the reporter's (b) emits `[[sampler(0)]]`/`[[texture(0)]]`, reflection matches emit, nested
ParameterBlock/resource arrays diagnosed. Repro: `slangc b.slang -target metal -entry frag_main -stage fragment`.

## Sources
- DeepWiki Q (2026-11-07): ParameterBlock→argument buffer on Metal; no flatten option; MetalParameterBlockElementTypeLoweringPolicy.
- SDL3 SDL_CreateGPUShader wiki (MSL argument-table rules; SPIR-V set 0/1 vertex, 2/3 fragment).
- Dedupe (gh search, 2026-11-07, 12 queries): no duplicate. Adjacent Metal ParameterBlock bugs: #14006, #14007, #14042,
  #14166, #13900 (DescriptorHandle layout), #13654, #9270, #7893 (AB tier-2 diagnostic/docs). Closed: #6200, #6803, #8199, #4500.
- Prior memos: triage-13654 (ConstantBuffer splits textures on Metal), triage-13900, triage-14042.
