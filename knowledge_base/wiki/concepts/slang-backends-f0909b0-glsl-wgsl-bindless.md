---
title: GLSL / WGSL emit (incl. WGSL via Tint), front-end recognition, buffer layout, bindless heaps, and overload resolution
type: concept
group: slang-backends
tags: [glsl, wgsl, tint, wgsl-spirv, bindless, descriptor-heap, nonuniform, buffer-layout, std430, overload, dxc, reflection, cross-module, ScalarDataLayout, uniform_buffer_standard_layout, requires]
source_count: 30
---

## TL;DR

- **WGSL emit has two type paths**: `_emitType` routes, `emitSimpleTypeImpl` emits the name. A router grep hit is not coverage; a new IR type usually needs a case in `emitSimpleTypeImpl`.
- **GLSL and Core are separate builtin modules**: a core decl marked `internal` is invisible to `glsl.meta.slang` callers and breaks the core-module build. Measure visibility fixes with a rebuild.
- **Default Vulkan/SPIR-V buffer layout is std430 (structured buffers, push constants) / std140 (ConstantBuffer)**; no auto-scalar at Vulkan 1.4. Scalar is tighter than C (packs into tail padding), so `scalar ≠ C`.
- **A GLSL SSBO reflects as a simple type layout**: element and container var-layout accessors both return nullptr.
- **On `-target wgsl-spirv(-asm)` (WGSL via Tint) the sub-context format is WGSL but `getTarget()` reports `WGSLSPIRV*`.** Exact `== CodeGenTarget::WGSL` checks are the bug class; use `isWGPUTarget()`. A layout-rule fix there also changes matrix storage.
- **Tint rows run only on Windows x64 CI and skip WGSL buffer lowering.** Capture Tint's input GPU-free with a stub `slang-tint` (`-tint-path <dir>`) or a fake library loader; validate with naga, wgpu-py or Dawn null.
- **A bindless storage-buffer heap with a dynamic index emits GLSL without `GL_EXT_nonuniform_qualifier`**; the "block operand" error after it is a glslang cascade. Test buffer-only: a texture heap masks the gap.
- **`-vk` bindless tests that dynamically index a heap need `-emit-spirv-directly`**, or they fail the shared "Test Slang via glsl" step in every GPU job (dx+vk+cuda). That looks backend-agnostic but is not.
- **Shader-visible `DescriptorHandle` `uint2`: ordinary handle = `.x` index, `.y` = 0, not a 64-bit split.** Only an acceleration structure is 64-bit (some targets); `.x`/`.y` = texture/sampler only in the split combined-sampler lowering.
- **`early_fragment_tests` needed only front-end recognition** (backend exists via `[earlydepthstencil]`). PR #13033 first ships in v2026.18.2; before that, put `[earlydepthstencil]` on GLSL `main()`. Check every patch tag for a first fixed release.
- **`globallycoherent` on a parameter is rejected in default mode** (`isModifierAllowedOnDecl` omits `ParamDecl`; a second gate hides behind it). "GLSL permitted" (`-allow-glsl`) ≠ "source is GLSL".
- **DXC duplicate semantics are backend-split** (DXIL errors on `TEXCOORD`+`TEXCOORD0`, DXC SPIR-V does not); Slang's silent re-index is Metal/WGSL-only.
- **A 202c GLSL-operator ambiguity comes from redundant equal-rank glsl spellings, not unreachable `OverloadRank`.** Capture the surviving candidates and ranks before theorizing.
- **`import glsl;` on WGSL/Metal hits E36107 from `glsl.meta.slang` `[require]` gates that predate WGSL** (634 of 698 omit wgsl). Widening a gate alone works only if the body forwards to a callee with metal/wgsl cases.
- **On WGSL, `ConstantBuffer<T, ScalarDataLayout>` reflects std140 but lowers Natural** (stride-4 `array<f32,N>` in `var<uniform>`, #13904). naga rejects it; Dawn/Chrome 144+ accepts it and mis-reads the buffer, since a supported language extension needs no `requires`. PR #13935 maps Scalar→Std430 and emits `requires uniform_buffer_standard_layout;`, but for every explicit CB.
- **Check a local build's commit before using it as a baseline**: `build/Release` can be hundreds of commits old and `slangc -v` can show a stale configure-time tag.
- **GLSL interface blocks never compile for Metal/WGSL**: `Std140DataLayout` is spirv/glsl-only and uniform blocks default to std140.
- **GLSL combined-sampler calls parenthesize every argument**: CHECK `texture({{.*}}name`. `-profile …+GL_EXT_X` / `-capability` never emit `#extension`; only per-use `__requireCapability`/`__glsl_extension` does.
- **Re-verify DeepWiki-sourced facts on your own instrument** (source, vendored DXC, a rebuild).

## Two type paths in the C-like emitters (WGSL example)

The C-like emitters split type handling into `_emitType` (declarator and routing) and
`emitSimpleTypeImpl` (the type name). During slang#12535, a claim that WGSL "already handles
`AttributedType`" rested on a grep hit at `slang-emit-wgsl.cpp:933`. That `case kIROp_AttributedType:`
was in `_emitType` and only routed to `emitSimpleTypeAndDeclarator`; `emitSimpleTypeImpl` had no
case, so a `unorm float` emitted an empty type and invalid WGSL (only Windows DX runners exercised
it). After a grep hit, identify the enclosing function and confirm it is on the path you care about
([WGSL emit has TWO type paths](../learnings/1786706500522-wgsl-emit-has-two-type-paths-emittype-routing-vs-e.md)).

## Cross-module visibility: GLSL is a separate builtin module

`internal` means visible within the same module only. The Core builtin module is
`core.meta.slang`+`hlsl.meta.slang`+`diff.meta.slang`; GLSL is a separate module
(`glslLanguageScope`, not `coreLanguageScope`). Adding `internal` to
`__getLegalizedSPIRVGlobalParamAddr`, which 8 `case spirv:` arms in glsl.meta.slang call, fails the
core-module rebuild with 360× `E30600 declaration not accessible` — a build-time failure that source
reading does not show. Before a visibility or gating fix, grep `glsl.meta.slang` for callers and measure with a rebuild. Alternatives: `[require(spirv)]`
builds and rejects non-spirv user calls at check time, but a spirv-targeting user still reaches the
emit ICE (necessary, not sufficient); or move the declaration into `glsl.meta.slang` next to its
callers (precedent: `__imageTexelPointer`)
([internal breaks cross-builtin-module calls](../learnings/1786522969053-internal-modifier-breaks-cross-builtin-module-call.md)).

## Buffer layout defaults and reflection

With no option given, Slang's Vulkan/SPIR-V layout is **std430** for StructuredBuffer and
RWStructuredBuffer elements and push constants, and **std140** for ConstantBuffer. No code path
auto-enables scalar layout at Vulkan 1.4 (the 1.4 code in spirv-legalize is about storage class).
Scalar, C and DX layouts come only from `-fvk-use-scalar-layout` / `-fvk-use-c-layout` /
`-fvk-use-dx-layout` or a per-buffer `StructuredBuffer<T, ScalarDataLayout|...>`. Tightness order:
scalar/natural ⊂ C ⊂ std430 ⊂ std140. Scalar packs a trailing field into a prior struct field's tail
padding, so it is not C-compatible for nested structs. The Vulkan tutorial's "auto-scalar at 1.4" claim is wrong
([default layout is std430/std140; scalar≠C](../learnings/1787601323178-slang-default-vulkan-spir-v-buffer-layout-is-std43.md)).
The tutorial's own `struct MyData { float3 a; float b; }` cannot show a difference (#12714,
v2026.20): `b`@12, stride 16 under std430, scalar and C alike. A discriminating type is
`struct S{double x; int y;}; struct U{S z; float w;}` — std430 and C give `w`@16, stride 24; scalar
gives `w`@12, stride 16. Check without the reflection API by grepping `slangc -target spirv-asm` for
`OpMemberDecorate ... Offset` and `ArrayStride`
([MyData cannot tell std430 from scalar](../learnings/1792400969481-vulkan-tutorial-mydata-float3-float-cannot-tell-st.md)).

A `GLSLShaderStorageBuffer<T>` reflects as a plain `SimpleLayoutInfo` (the standalone
`GetObjectLayout` branch), not a `ParameterGroupTypeLayout`. So
`spReflectionTypeLayout_GetElementVarLayout()` and `spReflectionTypeLayout_getContainerVarLayout()`
both return `nullptr`; they are non-null only inside `if (auto pg = as<ParameterGroupTypeLayout>(...))`,
which ConstantBuffer/TextureBuffer/ParameterBlock reach. A DeepWiki "high confidence" answer claimed
the opposite; read the accessors, the layout-construction branch and the AST hierarchy first
([SSBO reflection: null element and container](../learnings/1787660189955-glsl-ssbo-reflection-layout-has-null-element-and-n.md)).

On WGSL an explicit per-buffer layout splits reflection from the shader (#13904). For
`ConstantBuffer<T, ScalarDataLayout>` on `-target wgsl`, reflection comes from
`WGSLLayoutRulesFamilyImpl::getConstantBufferRules` (slang-type-layout.cpp:2896), which always returns
std140, but `getTypeLayoutRuleNameForBuffer` (slang-ir-lower-buffer-element-type.cpp:2571-2588)
honours the explicit Scalar op and maps it to Natural. The std140 vec4 wrapper is skipped, so a
`float[4]` field is emitted as `array<f32,4>` (stride 4) in `var<uniform>` while `-reflection-json`
reports stride 16. naga rejects the module. Dawn/Chrome 144+ accepts it and silently mis-reads the
buffer, because it supports `uniform_buffer_standard_layout`, and by WGSL §4.1.2 a supported
language extension is available without `requires X;`, which only documents the use.
`StructuredBuffer<S, ScalarDataLayout>` matches reflection only by luck, since WGSL storage layout is
about std430. `ScalarDataLayout` has no `[require]` and compiles silently, while
`Std140DataLayout`/`Std430DataLayout` give E36107 (the layout-type gate in the `import glsl;`
section below) ([ScalarDataLayout CB: reflection std140, IR Natural](../learnings/1792913060489-wgsl-scalardatalayout-constant-buffers-reflection-.md)). PR #13935 (head
a2ee40ce, open) adds `[require(wgsl)]` to both layouts, maps Scalar to Std430 on WebGPU targets,
emits `requires uniform_buffer_standard_layout;` and makes reflection use std430 rules. Offsets
agreed for `float[4]`+`float`, a vec3/vec2/`float3x3` mix, an array of CBs and an entry-point
`uniform` CB, and default output stayed byte-identical to master. It emits `requires` for every
explicit std430/scalar CB, even one whose std430 layout is already valid std140 (no scalar arrays),
so naga and Safari reject such modules for no layout reason. Check a local build's commit before
using it as a baseline: `/workspace/agent/slang/build/Release` was hundreds of commits behind master
(3649fb982 on 2026-10-25), and `slangc -v` can print a stale configure-time tag (g3649fb982 on a
build of 52e29ab43), so confirm top-of-tree with a recently merged behavior such as #13708's
`binding_array` output. In a fresh worktree, `git -c protocol.file.allow=always submodule update
--init --recursive` takes about 12 s, because the main checkout points submodule URLs at local
paths ([ConstantBuffer explicit layout: master vs PR #13935](../learnings/1792930635926-wgsl-constantbuffer-explicit-layout-master-vs-pr-1.md),
[check gpuweb before a chromium_* atom](../learnings/1792916916093-wgsl-chromium-experimental-features-check-gpuweb-b.md)).

## WGSL via Tint (`-target wgsl-spirv(-asm)`): requested target vs. sub-context format

On `-target wgsl-spirv`/`wgsl-spirv-asm`, Slang emits WGSL in a sub-CodeGenContext whose format
comes from `_getDefaultSourceForTarget(WGSLSPIRV) == WGSL` (slang-code-gen.cpp:278, :509/:534) and
hands it to Tint. The sub-context shares `m_shared`, so `getTargetReq()->getTarget()` still reports
`WGSLSPIRV`/`WGSLSPIRVAssembly`. Code that switches on `codeGenContext->getTargetFormat()`
(`linkAndOptimizeIR`, the C-like emitter, lower-combined-texture-sampler) is correct there; the bugs
are exact comparisons against `getTarget()` or the outer context's format:
`getTypeLayoutRuleNameForBuffer` (slang-ir-lower-buffer-element-type.cpp:2414-2417) checks
`== CodeGenTarget::WGSL`, then `isKhronosTarget`, and returns Natural, so the WGSL std140 vec4
packing of cbuffer scalar arrays (:662-692) never runs although the front end applies WGSL layout
rules (slang-type-layout.cpp:2984) (#13381/#13391); `emitEntryPoints` (slang-code-gen.cpp:1238-1302,
the #8323 abort); and `doesTargetAllowUnresolvedFuncSymbol` in slang-ir-link.cpp (an
`-incomplete-library` extern gives E45001 on the Tint path only). The fix is `isWGPUTarget()`
([WGSL-via-tint: check the REQUESTED target](../learnings/1790934790391-wgsl-via-tint-bugs-check-the-requested-target-not-.md)).
Coverage is thin: slang-tint is fetched only on Windows x64 (CMakeLists.txt:527-539,
`SLANG_SLANG_TINT_BINARY_URL`), elsewhere the rows fail to load 'tint' and report as ignored, and
even where it runs a `-target wgsl-spirv-asm` row does not cover WGSL buffer-element lowering; only
`-target wgsl` rows do
([wgsl-spirv-asm rows skip WGSL std140](../learnings/1790915313396-wgsl-spirv-asm-test-rows-do-not-exercise-wgsl-std1.md)).

A layout-rule fix there changes matrices too. With `isWGPUTarget` (PR #13402) Tint storage buffers
move from Natural to Std430, so buffer matrices go through `shouldLowerMatrixType`:
`RWStructuredBuffer<float2x2>` went from native `mat2x2` (bytes 1,2,3,4) to
`_MatrixStorage_*ColMajorstd430` (1,3,2,4), and `float2x3` from 32 to 24 bytes, now matching
reflection. Review layout-rule changes for matrices as well as scalar arrays
([Tint-path layout fixes change matrix storage](../learnings/1790962008492-tint-path-layout-fixes-also-change-matrix-storage-.md)).

Capturing the WGSL that Slang hands to Tint, on any platform, without a GPU:

- **CLI stub.** A ~10-line `libslang-tint.so` exporting `tint_compile(tint_CompileRequest*,
  tint_CompileResult*)` (write `req->wgslCode` to a file, return 1) and `tint_free_result`, per
  external/slang-tint-headers/slang-tint.h. Run `slangc … -target wgsl-spirv-asm -tint-path <dir>`
  (a directory; a full .so path fails to load) and diff against `-target wgsl`. A stub that returns
  real SPIR-V (from `-target spirv`), copied into `build/Release/lib`, makes slang-test report tint
  as supported and `-target wgsl-spirv` SIMPLE rows FileCheckable
  ([stub slang-tint](../learnings/1790932425083-slang-to-see-the-wgsl-that-target-wgsl-spirv-asm-p.md),
  [Tint-path layout fixes change matrix storage](../learnings/1790962008492-tint-path-layout-fixes-also-change-matrix-storage-.md)).
- **In-process unit test.** `IGlobalSession::setSharedLibraryLoader` with a loader that answers
  "slang-tint" with a fake `ISlangSharedLibrary` and forwards the rest to
  `DefaultSharedLibraryLoader::getSingleton()` (tools/slang-unit-test/unit-test-wgsl-spirv-tint-input.cpp,
  PR #13402). An `SLANG_UNEXPECTED` in getEntryPointCode is caught in
  `TargetProgram::getOrCreateEntryPointResult` and returned as SLANG_FAIL + E99997, so assert the
  diagnostic text; `IComponentType` holds a raw `Linkage*`, so keep the ISession alive
  ([capture the WGSL Slang hands to Tint](../learnings/1790957231882-capture-the-wgsl-slang-hands-to-tint-without-tint-.md)).
- **Validate the capture.** `pip install --target /tmp/x wgpu` (bundles naga; `request_adapter_sync()`
  finds llvmpipe; `create_shader_module` raises naga's error)
  ([stub slang-tint](../learnings/1790932425083-slang-to-see-the-wgsl-that-target-wgsl-spirv-asm-p.md)),
  or node-only `npm install naga-wasm@30.2.0` + `validate(parseWgsl(src))`
  ([GPU-free WGSL check via naga-wasm](../learnings/1791663423398-gpu-free-wgsl-parse-validate-check-naga-wasm-via-n.md);
  [[wiki/concepts/slang-backends-wgsl-matrix-and-validation.md]]). For real Tint diagnostics use
  Dawn's null backend (`npm install webgpu@0.6.2`, `backend=null`); naga rejects spec-valid f16
  bitcasts and `enable subgroups;`. See [WGSL emit and GPU-free validation](slang-backends-wgsl-matrix-and-validation.md).

Metal's cbuffer path through `getTypeLayoutRuleNameForBuffer` is on
[Metal buffer element lowering](../concepts/slang-backends-metal-buffer-lowering-and-layout-rules.md).

## Bindless descriptor heaps and the "Test Slang via glsl" CI leg

See also [DescriptorHandle emit on bindless and non-bindless targets](slang-backends-descriptor-handle-emit-and-bindless-targets.md) for the WGSL handle-spelling bug, `bit_cast` out of a handle, and WGSL resource tables (`getResource<T>`).

A bindless storage-buffer heap (`RWStructuredBuffer<T>.Handle` / `DescriptorHandle<RWStructuredBuffer<T>>`)
read with a dynamic index emits GLSL that glslang rejects with
`'variable index' : required extension not requested: GL_EXT_nonuniform_qualifier`, then
`'+' : wrong operand types ... block{... _data}`. The second error is glslang's error-recovery
cascade (it cannot resolve the chained `._data[j]`); the emitted `_slang_resource_heap[idx]._data[j]`
is fine. A constant index (`[0]`) compiles clean, proving one defect
([phantom "second bug"](../learnings/1788442267382-glsl-bindless-variable-descriptor-array-index-reje.md)).
Root cause: `GLSLSourceEmitter::tryEmitGlobalParamImpl` requests the extension for an unsized
resource array only after the structured/byte-address/param-group/SSBO early-returns, so textures
reach it and buffers do not. Fix: hoist the single request above the early-returns. A shader mixing a
texture heap with a buffer heap compiles anyway (the texture path requests the extension
file-wide), so the regression test must be buffer-only. Do not add `nonuniformEXT(...)` wrapping;
decoration propagation is the separate #12161
([buffer heap misses the extension; texture heap masks it](../learnings/1788445078995-slang-glsl-bindless-buffer-heap-misses-gl-ext-nonu.md)).

CI consequence (PR #12800, gap #12897): a `-vk` bindless test that dynamically indexes a heap must
add `-emit-spirv-directly` to its `COMPARE_COMPUTE` directive. Otherwise it fails the shared "Test
Slang via glsl" step, which re-runs `-vk` tests through glslang in every GPU `test-slang` job, so it
fails on dx, vk and cuda alike; the direct-SPIR-V path (default on Linux/macOS) is unaffected. The
per-directive flag overrides the injected `-emit-spirv-via-glsl` (`slang-test-main.cpp:4263`);
precedent `desc-handle-test-input.slang:1`. Reproduce GPU-free with
`slangc <test> -emit-spirv-via-glsl -target spirv-asm -stage compute -entry <e>`. Triage: pull the
job log before accepting "backend-agnostic, not my change" (three runners failing one step
deterministically is real code); `result code = 1` plus glslang errors is a real via-glsl failure;
bot-PR reds with every real job `skipped` are the priority-yield
([bindless -vk tests need -emit-spirv-directly](../learnings/1788440528410-bindless-vk-tests-need-emit-spirv-directly-via-gls.md),
[RWStructuredBuffer.Handle -vk tests hard-fail via glsl](../learnings/1788441444776-bindless-rwstructuredbuffer-handle-vk-tests-must-u.md)).

**Shader-visible `DescriptorHandle` `uint2` has three cases** (`hlsl.meta.slang` HEAD, Sep 2026,
docs PR #12938; distinct from host `uint64` packing — D3D12 2×32-into-64, Metal 128b):

- **Ordinary handle** (texture, sampler, buffer, CBV): `.x` = resource- or sampler-heap index, `.y`
  unused. Construction is `uint2(index, 0)` (`:27568`/`:27853`, sampler `:27864`) and every lookup
  reads only `.x` (`:27970`–`:27997`, HLSL `:28026/30`, WGSL `:28049`, `spvDescriptorHeapEXT`
  `:28052/56`). Not a 64-bit low/high split (the #12937 misconception).
- **Acceleration structure**: a 64-bit GPU address on the default SPIR-V/GLSL path
  (`RaytracingAccelerationStructure(__asuint64((uint2)handleValue))`, `:28000`); HLSL loads it from
  the resource heap by `.x` (`:28030`).
- **Combined texture-sampler**: `.x` = texture, `.y` = sampler only in the split lowering
  (HLSL/`spvDescriptorHeapEXT`, `__makeCombinedTextureSamplerFromHandle`); native SPIR-V
  combined-image-sampler (VkMutable) uses `.x` alone (`:27972`).

Scope every statement; the `defaultGetDescriptorFromHandle` /
`getDescriptorFromDynamicResourceHeap` target switches are the source of truth
([DescriptorHandle uint2 semantics](../learnings/1788849400575-descriptorhandle-uint2-component-semantics-shader-.md)).

## Front-end recognition gaps and language-mode subtleties

`layout(early_fragment_tests) in;` under `-allow-glsl` failed with E31217: `parseLayoutModifier`
recognizes bare GLSL layout qualifiers from a hardcoded list that lacked it. `[earlydepthstencil]`
already emits it on all targets (SPIR-V, GLSL, HLSL, Metal), so the fix is front-end recognition
only, mirroring how `local_size_*` synthesizes a `NumThreadsAttribute` from an `EmptyDecl`
([early_fragment_tests: backend already exists](../learnings/1787245492858-glsl-early-fragment-tests-input-qualifier-rejected.md)).
It landed as PR #13033 (#12655, merge 161b0812f, 2026-09-17); the first release is **v2026.18.2**,
not v2026.19 (`git merge-base --is-ancestor 161b0812f <tag>` is false for v2026.18.1, true for
v2026.18.2, whose tarball emits `OpExecutionMode %main EarlyFragmentTests`). Check every patch tag
this way
([#12655 first ships in v2026.18.2](../learnings/1792422160153-12655-early-fragment-tests-fix-first-ships-in-v202.md)).
On older releases, delete the layout line and put `[earlydepthstencil]` on the GLSL `void main()`;
verified on v2026.14.1
([workaround on old Slang](../learnings/1792400641518-glsl-early-fragment-tests-workaround-on-old-slang-.md)).

`globallycoherent RWByteAddressBuffer buffer` as a function parameter is rejected in default
`-lang slang` mode (E31201) but accepted with `-allow-glsl`: `isModifierAllowedOnDecl` has an
`if (isGLSLInput) return ... || as<ParamDecl>(decl)` branch, and the non-GLSL fall-through omits
`ParamDecl`. The stripped modifier then trips a call-site check (E30048; fix the gate, not that
check), and a second gate in `slang-check-decl.cpp` rejects memory qualifiers on non-`TextureType`
params, so both must widen
([globallycoherent on params](../learnings/1787705000586-globallycoherent-on-function-params-rejected-in-de.md)).
When converting the option-derived `bool isGLSLInput` to a `SourceLanguage`, do not prefer the
TU's `sourceLanguage` first: a `.slang` file with `-allow-glsl` keeps `sourceLanguage == Slang`, so
supported code would be rejected. AllowGLSL mode is not "the source is GLSL" (collapsing them is a
maintainer decision), and the `GLSLModuleModifier` fallback is load-bearing because
`m_translationUnitRequest` is nullptr on reflection/language-server paths
([prefer-TU-first drops -allow-glsl](../learnings/1787774464819-converting-option-derived-glsl-bool-to-sourcelangu.md)).

DXC duplicate-semantic behavior is backend-split (vendored DXC, `build/_deps/dxc_source-src/`). For
`TEXCOORD`+`TEXCOORD0`, DXIL errors (signature lowering normalizes both to `(TEXCOORD,0)`); DXC
SPIR-V does not (`getSemanticStr()` returns the raw string at index 0, so the dup-check sees two
names). Slang's silent re-index (`fixFieldSemanticsOfFlatStruct`) is Metal/WGSL-only; HLSL passes
semantics through. State DXC behavior from its source, not DeepWiki
([CORRECTION: DXC duplicate semantics backend-split](../learnings/1788388950993-correction-dxc-duplicate-semantic-behavior-is-back.md)).

## A GLSL-operator overload regression: equal-rank spellings, not unreachable rank

Gating off the generic-parameter-count tie-breaker in `compareOverloadCandidateSpecificity`
(`slang-check-overload.cpp:2214`) for 202c (#12829) regresses `builtin-operator-fastpath-glsl.slang`:
`mat*mat`, `vec==vec`, `vec!=vec` become E39999 ambiguous under `-std 202c -allow-glsl`. The wrong
diagnosis was "the generic early-return at :2420-2426 skips `OverloadRank`". The captured candidate
set refutes it: both survivors are same-operator `glsl.meta.slang` overloads with identical
`[OverloadRank(15)]`, differing only in generic-param count (`operator*<let N>(matrix<float,N,N>,…)` :231 vs `operator*<T,let L,C,R>(…)` :255;
`operator==` :396 vs :344). Both are fully specialized at the compare step, so the early-return does
not fire and rank is reached at :2433 (probes: ranks 5 vs 9 resolve, 15 vs 15 is ambiguous). The core
component-wise operators drop out earlier on conversion cost. The root cause is redundant same-operator
glsl spellings that only the count heuristic separated. The fix needs a core-module/language-design
change (distinct ranks, merged spellings, or a structural-specificity rule), not the 202c gate
alone; the maintainer moved spike PR #12830 back to draft over this. Capture the surviving
candidates with their ranks, flavors and conversion-cost ties before theorizing
([#12829 regresses glsl operators](../learnings/1787965868058-slang-12829-removing-generic-param-count-tie-break.md),
[CORRECTION: equal-rank redundant spellings](../learnings/1787966040183-correction-slang-12829-glsl-regression-is-equal-ra.md)).

## `import glsl;` on WGSL/Metal: `glsl.meta.slang` require gates and std140 blocks

`import glsl;` (or `-lang glsl`, which imports it implicitly) with a matrix `a * b` on `-target wgsl`
or `-target metal` fails E36107 (#13350). `glsl.meta.slang:226-287` gates the three `operator*` and
four `operator*=` overloads with `[require(cpp_cuda_glsl_hlsl_spirv_llvm, sm_4_0_version)]`, a set
that predates WGSL (#3912 before #5006) and that the later `*=` overloads (#9501) copied; the sibling
`==`/`!=` use `cpp_cuda_glsl_hlsl_metal_spirv_wgsl_llvm`. Unlike the fwidth trap, which also needs a
`__target_switch` case (see [WGSL/Metal cross-target emission](../concepts/slang-backends-wgsl-metal.md)),
widening the gate alone is enough: the bodies forward to `mul`, which has metal/wgsl cases, and a
prototype emitted native `a * b` like the GLSL target. Workaround: GLSL `a * b` equals `mul(b, a)`.
Rebuild `slang-glsl-module slangc` after `cmake -E touch source/slang/glsl.meta.slang` (minutes)
([matrix `*` E36107 is an operator gate](../learnings/1790793913411-e36107-on-wgsl-metal-with-import-glsl-matrix-glsl-.md)).
The class is large: 634 of 698 `glsl.meta.slang` `[require]` gates omit wgsl, and after PR #13356, 62
declarations (`mix`, `mod`, `atan(y,x)`, `inversesqrt`, …) are still gated to
`cpp_cuda_glsl_hlsl_spirv_llvm` (#13355). Before widening one, check that its callees have
metal/wgsl cases.

A second gate sits on the layout types. `Std140DataLayout` is `[require(spirv)] [require(glsl)]`
(`hlsl.meta.slang:41-45`) and `Std430DataLayout` is spirv/glsl/llvm only, so any GLSL
`layout(std140) uniform {…}` or `buffer {…}` block gives E36107 on metal and wgsl (PR #13935
would add wgsl to both; see Buffer layout defaults above). Dropping
`std140` does not help, because uniform blocks default to std140. Consequently
`tests/glsl/matrix-mul.slang`'s METAL lane has never compiled; it passes only because its regex
matches the diagnostic's quoted source (see
[test authoring](../concepts/slang-tooling-f0909b0-test-authoring-filecheck.md))
([GLSL interface blocks never compile for Metal](../learnings/1790798404070-glsl-interface-blocks-never-compile-for-metal-std1.md)).

## GLSL emit shape: combined-sampler parens and where `#extension` comes from

From reviewing #13333 (Release, a05023cd30). A combined-sampler call such as
`SamplerCubeArrayShadow.SampleCmpBias(...)` on `-target glsl` emits
`texture((combinedShadowCubeArray_0), (_S1), (0.5), (0.25))`, so
`CHECK: texture(combinedShadowCubeArray` never matches; use `texture({{.*}}name`. A separate
Texture + `SamplerComparisonState` emits `texture(samplerCubeArrayShadow(tex_0,samp_0), …)`. A
reviewer bot's untested CHECK had this bug; run a suggested CHECK at head before posting it.
`-profile glsl_460+GL_EXT_X` and `-capability GL_EXT_X` do not emit `#extension GL_EXT_X`; only a
per-use `__requireCapability` / `__glsl_extension` (`IRRequireTargetExtension`) does. So a profile that includes the extension does not make an `#extension` assertion vacuous. To drill
failability, break the compiler, not the test: remove the wrapper's `__glsl_extension` +
`__requireCapability`, or revert `SampleCmpBias`→`SampleCmp` in the `glsl.meta.slang` `default:`
branch, then `cmake -E touch` the meta file and rebuild `generate_core_module_headers` + `slangc`
(~3 min on Release). Under that drill `sample-cmp.slang` and `intrinsic-texture.slang` still passed;
only the new per-form tests failed
([combined-sampler parens; profile caps don't emit `#extension`](../learnings/1790724590745-glsl-emit-combined-sampler-calls-are-texture-name-.md)).

**Source learnings (30):**

- [WGSL emit has TWO type paths](../learnings/1786706500522-wgsl-emit-has-two-type-paths-emittype-routing-vs-e.md) — `_emitType` routes, `emitSimpleTypeImpl` names the type.
- [internal breaks cross-builtin-module calls](../learnings/1786522969053-internal-modifier-breaks-cross-builtin-module-call.md) — GLSL is a separate builtin module; measure with a core-module rebuild.
- [Default Vulkan/SPIR-V layout is std430/std140; scalar≠C](../learnings/1787601323178-slang-default-vulkan-spir-v-buffer-layout-is-std43.md) — no auto-scalar at Vulkan 1.4; scalar ⊂ C.
- [SSBO reflection: null element and container var-layout](../learnings/1787660189955-glsl-ssbo-reflection-layout-has-null-element-and-n.md) — simple type layout; DeepWiki was wrong.
- [bindless -vk tests need -emit-spirv-directly](../learnings/1788440528410-bindless-vk-tests-need-emit-spirv-directly-via-gls.md) — via-glsl step runs in every GPU job; per-directive flag overrides it.
- [RWStructuredBuffer.Handle -vk tests hard-fail via glsl](../learnings/1788441444776-bindless-rwstructuredbuffer-handle-vk-tests-must-u.md) — PR #12800/#12897; read the job log.
- [GLSL bindless phantom "second bug"](../learnings/1788442267382-glsl-bindless-variable-descriptor-array-index-reje.md) — block-operand error is a glslang cascade; a constant index compiles clean.
- [buffer heap misses GL_EXT_nonuniform_qualifier](../learnings/1788445078995-slang-glsl-bindless-buffer-heap-misses-gl-ext-nonu.md) — hoist the request above the early-returns.
- [early_fragment_tests: backend already exists](../learnings/1787245492858-glsl-early-fragment-tests-input-qualifier-rejected.md) — fix is front-end recognition only.
- [early_fragment_tests workaround on old Slang](../learnings/1792400641518-glsl-early-fragment-tests-workaround-on-old-slang-.md) — `[earlydepthstencil]` on GLSL `main()`; verified v2026.14.1.
- [MyData{float3; float} cannot tell std430 from scalar](../learnings/1792400969481-vulkan-tutorial-mydata-float3-float-cannot-tell-st.md) — use `U{S{double;int} z; float w;}`; grep `Offset`/`ArrayStride` (#12714).
- [#12655 fix first ships in v2026.18.2](../learnings/1792422160153-12655-early-fragment-tests-fix-first-ships-in-v202.md) — check each patch tag with `git merge-base --is-ancestor`.
- [globallycoherent on params rejected in default mode](../learnings/1787705000586-globallycoherent-on-function-params-rejected-in-de.md) — `isModifierAllowedOnDecl` omits `ParamDecl`; a second gate hides behind.
- [prefer-TU-first drops -allow-glsl](../learnings/1787774464819-converting-option-derived-glsl-bool-to-sourcelangu.md) — "GLSL permitted" ≠ "source is GLSL"; `GLSLModuleModifier` fallback needed.
- [CORRECTION: DXC duplicate semantics backend-split](../learnings/1788388950993-correction-dxc-duplicate-semantic-behavior-is-back.md) — DXIL errors, DXC SPIR-V index-0 gap; Slang re-index Metal/WGSL-only.
- [#12829 regresses glsl operators](../learnings/1787965868058-slang-12829-removing-generic-param-count-tie-break.md) — glsl-vs-glsl at equal rank 15.
- [CORRECTION: #12829 is equal-rank redundant spellings](../learnings/1787966040183-correction-slang-12829-glsl-regression-is-equal-ra.md) — rank is reached; capture candidates first.
- [DescriptorHandle uint2 semantics](../learnings/1788849400575-descriptorhandle-uint2-component-semantics-shader-.md) — ordinary `.x`/`.y`=0; AS 64-bit on some targets; split sampler only (#12938).
- [combined-sampler parens; no `#extension` from profile](../learnings/1790724590745-glsl-emit-combined-sampler-calls-are-texture-name-.md) — `texture((name_0), …)`; drill by breaking the compiler (#13333).
- [matrix `*` E36107 is an operator gate](../learnings/1790793913411-e36107-on-wgsl-metal-with-import-glsl-matrix-glsl-.md) — `import glsl;` on wgsl/metal; widen gate, bodies forward to `mul` (#13350).
- [GLSL interface blocks never compile for Metal](../learnings/1790798404070-glsl-interface-blocks-never-compile-for-metal-std1.md) — `Std140DataLayout` gate; matrix-mul METAL vacuous; 62 decls gated (#13355).
- [WGSL ScalarDataLayout constant buffers: reflection std140 vs IR Natural (#13904); requires-directive is documentation only](../learnings/1792913060489-wgsl-scalardatalayout-constant-buffers-reflection-.md) — `getConstantBufferRules` std140 vs `getTypeLayoutRuleNameForBuffer` Natural; Dawn accepts silently.
- [WGSL ConstantBuffer explicit layout: master vs PR #13935 behavior, and verification gotchas](../learnings/1792930635926-wgsl-constantbuffer-explicit-layout-master-vs-pr-1.md) — Scalar→Std430 + `requires` for every explicit CB; stale build/Release; submodule init.
- [WGSL Chromium-experimental features: check gpuweb before adding a chromium_* capability atom](../learnings/1792916916093-wgsl-chromium-experimental-features-check-gpuweb-b.md) — here for the stale `slangc -v` tag gotcha.
- [wgsl-spirv-asm rows skip WGSL std140](../learnings/1790915313396-wgsl-spirv-asm-test-rows-do-not-exercise-wgsl-std1.md) — layout rule returns Natural there; only `-target wgsl` rows cover it.
- [stub slang-tint to see its WGSL input](../learnings/1790932425083-slang-to-see-the-wgsl-that-target-wgsl-spirv-asm-p.md) — `tint_compile` writes `req->wgslCode`; `-tint-path <dir>`; validate via wgpu-py.
- [WGSL-via-tint: check the REQUESTED target](../learnings/1790934790391-wgsl-via-tint-bugs-check-the-requested-target-not-.md) — exact `getTarget()` checks are the bug class; use `isWGPUTarget()`.
- [capture the WGSL Slang hands to Tint](../learnings/1790957231882-capture-the-wgsl-slang-hands-to-tint-without-tint-.md) — fake library loader; E99997; raw `Linkage*`.
- [Tint-path layout fixes change matrix storage](../learnings/1790962008492-tint-path-layout-fixes-also-change-matrix-storage-.md) — Natural→Std430 routes matrices via `shouldLowerMatrixType`.
- [GPU-free WGSL check via naga-wasm](../learnings/1791663423398-gpu-free-wgsl-parse-validate-check-naga-wasm-via-n.md) — node-only alternative to wgpu-py.
