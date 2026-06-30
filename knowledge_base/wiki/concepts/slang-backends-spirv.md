---
title: "Slang SPIR-V Backend: Emission, Capabilities, and Validation"
type: concept
group: slang-backends
tags: [spirv, vulkan, codegen, capabilities, descriptor-heap, debug-info, atomics]
source_count: 70
---

# Slang SPIR-V Backend: Emission, Capabilities, and Validation

The SPIR-V backend is Slang's primary Vulkan/Khronos target, implemented via a direct emitter (`slang-emit-spirv.cpp`) combined with a legalization pass (`slang-ir-spirv-legalize.cpp`) and the bundled `slang-glslang` module for `spirv-opt`. This page covers the core mechanisms for capability declaration, descriptor-heap emission, debug-info, atomics, and common pitfalls.

## Entry Points and Module-Level Emission

Slang's default SPIR-V behavior renames every entry point to `"main"` (a legacy from GLSL-via codegen). The flag `-fvk-use-entrypoint-name` (API: `VulkanUseEntryPointName`) preserves the source name. A non-obvious rule: Slang **auto-applies** `-fvk-use-entrypoint-name` when a module has more than one entry point (per PR #6260), so single-entry shaders still get renamed to `"main"` and fail `VkPipelineShaderStageCreateInfo` validation with VUID-VkPipelineShaderStageCreateInfo-pName-00707 unless the flag is passed uniformly ([[wiki/learnings/1779621920622-slang-spir-v-entry-point-rename-auto-applies-only-.md]]).

The `[require(spirv_1_x)]` decoration that controls the emitted SPIR-V version must reach the **codegen IR module** (not only the layout/reflection module) via `addEntryPointRequireCapabilityDecorations()`. A secondary fix is also required: `determineSpirvVersion()` must match on internal `_spirv_1_x` atoms, not the public alias. Without both changes, `[require(spirv_1_5)]` leaves the SPIR-V at version 1.0 ([[wiki/learnings/1781643037138-correction-to-11631-version-root-cause-require-ato.md]]).

## Capability Declaration

**Adding a capability atom:** The single source of truth is `source/slang/slang-capabilities.capdef`. Two lines are needed per capability — an extension atom (`def SPV_EXT_foo : _spirv_1_0;`) and a capability atom (`def spvFooEXT : SPV_EXT_foo;`). Each requires `///` doc comment + `/// [EXT]` tag. The build runs `slang-capability-generator` to produce the C++ enum headers — never hand-edit those. Adding an atom also regenerates two checked-in docs: `docs/user-guide/a3-02-reference-capability-atoms.md` (alphabetical) and `docs/command-line-slangc-reference.md` (declaration order, byte-exact diff enforced by CI) ([[wiki/learnings/1781120340432-adding-a-spir-v-capability-atom-to-slang-capdef-re.md]], [[wiki/learnings/1781122622446-adding-a-spir-v-capability-atom-addendum-two-gener.md]]).

**Gating emit on a capability atom:** The correct pattern is `targetCaps.implies(CapabilityAtom::spvFooEXT)`. Do NOT gate on `isSPIRV(...)` (fires unconditionally for every SPIR-V target) and do NOT gate on extension-string atoms where a capability atom exists. The established precedent in `slang-emit-spirv.cpp:1692` gates on `CapabilityAtom::spvBindlessTextureNV`; ~8 sibling sites confirm this. An earlier triage learning incorrectly advised `isSPIRV()` — the correction is in [[wiki/learnings/1781123971590-correction-spir-v-capability-emit-gating-use-impli.md]]. When adding a conditional capability for a stdlib `spirv_asm` intrinsic, see the option tree in [[wiki/learnings/1781974573249-conditionally-requiring-a-spir-v-capability-for-a-.md]] (options: constexpr-only, post-hoc pass rewrite, new IR op, placeholder operand idiom).

**Triaging "add a capability" requests:** Check `external/spirv-headers/include/spirv/unified1/spirv.h` first — the `SpvCapability*` constant is usually already vendored. A bare capdef atom is inert until consumed by a `[require(...)]` intrinsic or C++ emit site ([[wiki/learnings/1781116222932-triaging-an-quot-add-a-spir-v-capability-bit-quot-.md]]). New `Spv*` enum constants resolve from the SPIRV-Headers package, NOT from the stale `external/spirv/spirv.h` ([[wiki/learnings/1782322517394-slang-spir-v-emit-new-spv-enum-constants-resolve-f.md]]).

**SPV_KHR_abort and multi-dependency chains:** `OpAbortKHR` is a block terminator (like OpKill) requiring both `SPV_KHR_abort` AND `SPV_KHR_constant_data` (for the `OpConstantDataKHR` message). New SPIR-V extension intrinsics must be modeled as terminators, not printf-parallel — after emitting the terminator, block emission must stop and unreachable code must be removed ([[wiki/learnings/1781039584587-when-planning-a-new-spir-v-opcode-check-terminator.md]], [[wiki/learnings/1782248897717-spv-khr-abort-transitively-requires-spv-khr-consta.md]]).

**Conditionally requiring a capability for ray tracing:** To limit a shader to `SPV_KHR_ray_query` without pulling in `SPV_KHR_ray_tracing`, use `-capability spvRayQueryKHR` and verify no `TraceRay`/raygen path re-introduces the extension. The `RaytracingAccelerationStructure` type itself triggers a dual "any" requirement; post-PR #6615 dedup should collapse it to ray_query when only `RayQuery` usage exists ([[wiki/learnings/1781905197543-slang-as-forcing-ray-query-only-capability-avoid-s.md]]).

## Builtin Variables and Memory-Access Masks

`IRSPIRVAsmOperandBuiltinVar` is `hoistable=true` — cross-stage uses of the same builtin (e.g. compute + raygen sharing `SubgroupLocalInvocationId`) always collapse to a single inst via `_findOrEmitHoistableInst`. Adding a cache-key axis to `BuiltinSpvVarKey` for cross-stage differentiation is dead code under today's IR ([[wiki/learnings/1779617050641-slang-spirv-asm-operand-builtinvar-is-hoistable-co.md]]).

The `getBuiltinGlobalVar` cache-hit trap: when adding a side-table like `m_volatileBuiltinGlobalVars` inside `getBuiltinGlobalVar`, populate it BEFORE the cache-hit early return. Otherwise the second call site that hits the cache misses the set entirely. Additionally, `spirv_asm` blocks bypass `emitLoad` — the `case SpvOpLoad:` branch in `emitSPIRVAsm` must also be extended ([[wiki/learnings/1779612967874-slang-emit-spirv-builtin-var-cache-and-the-volatil.md]]).

When injecting a memory-access mask (e.g. `Volatile`) into a `spirv_asm` OpLoad that already carries a user-supplied mask, emit ONE combined mask word, not two consecutive words. The scan for existing user masks must include both `kIROp_SPIRVAsmOperandLiteral` and `kIROp_SPIRVAsmOperandEnum` ([[wiki/learnings/1779617068760-slang-emit-spirv-extra-memoryaccess-word-grammar-b.md]]).

**Hoistable operand mutation rule:** Never mutate a `SPIRVAsmOperandEnum` or `SPIRVAsmOperandLiteral` in place — they are hoistable (value-numbered) and `setOperand` on them trips an assert at `slang-ir.cpp:179`. Build a fresh operand and repoint the non-hoistable consumer (`spvInst->setOperand(maskIndex+1, newOperand)`) ([[wiki/learnings/1781725591470-never-mutate-a-hoistable-spirvasmoperand-in-place-.md]], [[wiki/learnings/1781726667133-spir-v-asm-operand-legalization-hoistable-operands.md]]).

## Descriptor Heap (spvDescriptorHeapEXT)

The `spvDescriptorHeapEXT` path uses `kIROp_SPIRVLoadDescriptorFromHeap` (not `IRCastDescriptorHandleToResource`). Four function-call specialization sites in `slang-ir-specialize-function-call.cpp` and `slang-ir-specialize-buffer-load-arg.cpp` originally accepted only the cast variant, causing a SIGSEGV (#11498) when the heap-EXT variant wasn't handled ([[wiki/learnings/1780729707220-spvdescriptorheapext-path-uses-kirop-spirvloaddesc.md]], [[wiki/learnings/1780733286644-spvdescriptorheapext-path-fix-function-call-specia.md]]).

**Heap operand must not be parameterized:** The `heap` operand of `SPIRVLoadDescriptorFromHeap` is the module-scoped `kIROp_SPIRVResourceHeap` builtin global; at emit it materializes as `OpUntypedVariableKHR` in `UniformConstant`. Parameterizing it as a `uint` OpFunctionParameter makes the cloned callee's access-chain base a `uint` scalar — invalid SPIR-V. Correct shape: parameterize ONLY the index; put the heap in the specialization cache key but not `newArgs` ([[wiki/learnings/1780734760813-spvdescriptorheapext-specialization-fix-don-t-para.md]], [[wiki/learnings/1780769340224-spirvloaddescriptorfromheap-heap-operand-is-a-poin.md]]).

**ConstantBuffer via spvDescriptorHeapEXT crashes in emit (#11483):** A storage-class divergence (`getDescriptorHeapBufferStorageClass` maps ConstantBuffer to `Uniform` on pre-1.4, `StorageBuffer` on 1.4+) causes a crash in `emitDescriptorHeapLoad`. Unlike `StructuredBuffer`, the crash occurs even for scalar member access ([[wiki/learnings/1780643259838-constantbuffer-via-spvdescriptorheapext-sigsegvs-i.md]]).

**AS descriptor stride:** When emitting `DescriptorHandle<RaytracingAccelerationStructure>`, drive the runtime-array element type from the LOAD type (`uint64`), not the resource type (`OpTypeAccelerationStructureKHR`). The AS size is opaque, so `OpConstantSizeOfEXT(OpTypeAccelerationStructureKHR)` gives a non-portable stride ([[wiki/learnings/1779962007180-spvdescriptorheapext-stride-is-opaque-for-as-load-.md]]).

**Atomic-dest validator false-negative (#11506):** `processImageSubscript` rewrites the atomic dest into `IRSPIRVLoadTexelPointerFromHeap` (AddressSpace::Image) AFTER atomic validation runs. `isValidAtomicDest` accepted `IRImageSubscript` but not the heap texel pointer — fix adds a one-liner. A separate spirv-val failure (#11130) for `format=Unknown` on bindless textures is a distinct independent bug ([[wiki/learnings/1780865902537-slang-spvdescriptorheapext-atomic-dest-validator-r.md]], [[wiki/learnings/1780869756318-descriptor-heap-texture-atomics-e41403-validator-g.md]]).

**Unified stride:** The descriptor-heap emits a DISTINCT `OpTypeRuntimeArray` per element type (cached on `(descriptorElementType, arrayStride)`). A symbolic max stride via `OpSpecConstantOp Select(UGreaterThan(...), ...)` over `OpConstantSizeOfEXT` values passes the bundled spirv-val ([[wiki/learnings/1782264945972-spvdescriptorheapext-unified-stride-per-type-array.md]], [[wiki/learnings/1782271381546-spirv-val-accepts-opspecconstantop-max-over-opaque.md]]).

## VariablePointers

`requireVariableBufferCapabilityIfNeeded` is called from value-materialization sites (var/phi/call/element-ptr/load), NOT from function-signature emission. A `Ptr<T, GroupShared>` that survives as a `[noinline]` function parameter emits a valid `OpTypeFunction %_ptr_Workgroup_T` but NO `OpCapability VariablePointers`. Fix: walk the function type in `emitFunc` and gate on `IRNoInlineDecoration` (not `hasUses()`) — inlined helpers retain uses but must not spuriously declare the cap, which triggers driver miscompile #9061 ([[wiki/learnings/1780967438806-slang-spir-v-variable-pointers-cap-is-declared-fro.md]], [[wiki/learnings/1781023718622-signature-derived-spir-v-variablepointers-must-gat.md]], [[wiki/learnings/1780970685981-slang-spir-v-isolating-a-signature-only-variablepo.md]]).

## Atomics

The SPIR-V atomic emit has FOUR cross-layer gates keyed on address space. When adding an `AddressSpace` case, all four must be updated: (1) front-end l-value check E30047, (2) IR validator `isValidAtomicDest` E41403, (3) emitter `isAtomicableAddressSpace` (AtomicLoad/Store/Exchange only; fallback to non-atomic emitLoad/emitStore silently loses atomicity), (4) emitter `emitMemorySemanticMask` (missing case → `memoryClass=0` → VUID-10870). `AtomicAdd`/`Inc`/`Dec`/`CompareExchange` bypass gate 3 and always emit the atomic op ([[wiki/learnings/1782322436550-spir-v-atomic-emit-has-two-address-space-gates-a-p.md]], [[wiki/learnings/1782346122322-slang-spir-v-atomic-emission-has-4-cross-layer-gat.md]]).

**groupshared-by-reference regression:** Lowering a `groupshared T arr[N]` parameter by-reference (to fix D3D TGSM loss) creates a `Workgroup` pointer that cannot cross a SPIR-V function boundary without `VariablePointers`. Fix: extend `GLSLResourceReturnFunctionInliningPass::shouldInline` (Khronos-gated) to also inline callees with a `groupshared`-rate parameter, keyed on `as<IRGroupSharedRate>(param->getRate())` not the value type ([[wiki/learnings/1782237919713-groupshared-by-reference-param-regresses-khronos-s.md]]).

## spirv-opt / slang-glslang Integration

`slang-glslang` is Slang's SPIR-V backend library (bundles SPIRV-Tools including `spirv-opt`) — the name is misleading; it has nothing to do with GLSL. It is always a runtime-loaded MODULE, never static-linked. The correct fix for "missing slang-glslang in a static build" is a build-system change (provide the module), not making its load non-fatal ([[wiki/learnings/1782152994624-slang-glslang-is-the-spir-v-backend-don-t-mask-its.md]]).

`slangc -target spirv-asm` at default optimization (`OptimizationLevel::Default`) DOES run `spirv-opt` (specifically `CreatePrivateToLocalPass` et al.) — this is not the same as `-O0` ([[wiki/learnings/1781714495665-slangc-target-spirv-asm-at-default-opt-does-run-sp.md]]). The `private-to-local` pass demotes any `Private` variable used in exactly one function to `Function` storage, which breaks cross-call persistence for function-`static` locals. Fix: remove the two live registrations of `CreatePrivateToLocalPass` ([[wiki/learnings/1781713084820-spir-v-function-static-state-loss-spirv-tools-priv.md]]).

**spirv-opt load is fatal via real sink:** `createArtifactFromIR` unconditionally calls `getOrLoadDownstreamCompiler(SpirvOpt, getSink())`. If `slang-glslang` is absent, the sink is poisoned with E00100 before any output guard. Deliberately-optional callers pass `nullptr` sink ([[wiki/learnings/1781799089141-slang-downstream-compiler-load-optional-spirv-opt-.md]], [[wiki/learnings/1781804734767-slang-downstream-compiler-absence-spirv-opt-slang-.md]]). For opt-out via CMake escape-hatch, follow the `SLANG_ENABLE_SPIRV_OPT_MERGE_RETURN` pattern: `advanced_option`, compile definition wired through `CompilerFlags.cmake`, and `#if ... #endif` guards around ALL registrations including dead `#if 0` blocks ([[wiki/learnings/1781975592365-slang-glslang-add-an-opt-out-via-dedicated-cmake-e.md]]).

**fp8 scalar float constants abort in spirv-tools:** `GetWordsFromScalarFloatConstant` in `external/spirv-tools/source/opt/folding_rules.cpp` asserts `width == 16 || 32 || 64`; width-8 (fp8) is missing. The integer sibling handles width-8 correctly. Tracked as issue #11766 for an upstream fix; Slang-side workaround is expected-failure (#11744) ([[wiki/learnings/1782449605671-fp8-scalar-float-constants-abort-in-spirv-tools-co.md]]).

## Debug Information

**-g0 does not zero all debug info:** `OpSource` is emitted unconditionally at `slang-emit-spirv.cpp:11838` without consulting the debug level. `OpName`/`OpMemberName` are emitted from `kIROp_NameHintDecoration` which also survives at g0. Neither is gated on `m_targetProgram->getOptionSet().getDebugInfoLevel()` ([[wiki/learnings/1782145409789-slang-g0-doesn-t-zero-spir-v-debug-info-opsource-o.md]]).

**Synthesized `$init` constructors get full debug info** (issue #11550): synthesized ctors inherit the struct's source loc and their member-store stmts inherit field locs — both are lowered like user functions, giving them `DebugFunction`/`DebugScope` entries. Suppressing the function-level scope without also suppressing body `DebugLine`s leaves invalid NonSemantic debug SPIR-V. Gate on AST flavor (`SynthesizedDefault | SynthesizedMemberInit`) during lowering ([[wiki/learnings/1781168370965-slang-synthesized-init-ctors-get-full-source-level.md]]).

**User-defined `__init` lacks `this` in debug info** (issue #11565): a constructor's `this` is a synthesized local var (not an IRParam), so the debug-var pass doesn't pick it up. Fix: after emitting `thisVar` at `slang-lower-to-ir.cpp:13839`, add a "this" name hint + `IRDebugLocationDecoration` so the local-var loop emits it ([[wiki/learnings/1781206942083-slang-user-defined-init-lacks-this-in-spir-v-debug.md]]).

**Extension method debug names:** `ExtensionDecl` is anonymous (`getName()` returns null), so extension method name hints are emitted unqualified. Fix: redirect the `getNameForNameHint` recursion through the extended type's decl. Note: the name hint also feeds C-like emitter identifiers (HLSL/CUDA), not just SPIR-V debug names ([[wiki/learnings/1781267563910-getnamefornamehint-feeds-c-like-emitter-identifier.md]]).

**DebugScope variable-arity rule:** `IRDebugScope` must be built with 1 or 2 operands (1 when `inlinedAt` is absent) — never with 2 operands where operand 1 is null. A null operand crashes `buildEntryPointReferenceGraph` at `slang-ir-call-graph.cpp:~85` which iterates operands unguarded ([[wiki/learnings/1781568128097-spir-v-debugscope-must-be-variable-arity-null-ir-o.md]]).

**`-g2` test self-match trap:** At `-g2`, the full source is embedded as an `OpString`. A `CHECK-NOT` pattern whose text appears in a `//CHECK` directive line will falsely fail by matching the embedded copy. Use real quotes or `@LINE`-relative patterns to avoid this ([[wiki/learnings/1781176200581-slang-g2-spirv-asm-filecheck-tests-embedded-source.md]]).

## Depth Output Execution Modes

**Direct SPIR-V path** emits both `DepthReplacing` AND `DepthGreater`/`DepthLess` for `SV_DepthGreaterEqual`/`SV_DepthLessEqual`. When two depth-affecting builtins coexist (e.g. `SV_Depth` + `SV_DepthGreaterEqual`), `maybeEmitEntryPointDepthReplacingExecutionMode` collapses to `DepthReplacing` only via the `else if (mode != thisMode)` conflict branch ([[wiki/learnings/1782165817624-slang-sv-depth-greater-less-equal-direct-spir-v-co.md]], [[wiki/learnings/1782211031715-slang-direct-spir-v-depth-mode-also-dropped-via-co.md]]).

**Output topology (hull/domain):** The `case kIROp_OutputTopologyDecoration:` hull/domain arm handles only TriangleCW/TriangleCCW/Point; `Line` falls through to the mesh-shader fallback arm emitting `OutputLinesEXT` — invalid on tess stages. For isoline, `Line` should be a no-op (the `OpExecutionMode Isolines` from `[domain("isoline")]` already implies it). The fallback must be stage-guarded ([[wiki/learnings/1780253722562-slang-spir-v-output-topology-hull-domain-arm-only-.md]]).

## Validation and Testing

**spirv-val must be run explicitly:** A clean `slangc` exit is not sufficient. The compiler can emit structurally invalid SPIR-V that only `spirv-val` detects ([[wiki/learnings/dashboard_slang-triage-1776263007885.md]]). Under CI, `SLANG_RUN_SPIRV_VALIDATION=1` is set — a unit test asserting the absence of a validation-related diagnostic will pass locally and fail in CI ([[wiki/learnings/1781825083619-ci-runs-slang-test-with-slang-run-spirv-validation.md]]).

**Text FileCheck cannot catch malformed access-chain bases:** `//TEST:SIMPLE` does NOT run SPIR-V validation. For descriptor-heap / access-chain fixes, run `SLANG_RUN_SPIRV_VALIDATION=1` out-of-band or write FileCheck that pins the base to the heap builtin global ([[wiki/learnings/1780769340224-spirvloaddescriptorfromheap-heap-operand-is-a-poin.md]]).

**Triage discriminator — embedded spirv-tools vs system validation layer:** At HEAD ~2026-06 the embedded spirv-tools is v2026.2. A VUID that fires only in a maintainer's system layer (Vulkan SDK 1.4.328+) is validator version-skew, not a master regression ([[wiki/learnings/1782267495019-triage-discriminator-slang-embedded-spirv-tools-vs.md]]).

**Local verify LD_LIBRARY_PATH trap:** Always put `build/Debug/lib` FIRST in `LD_LIBRARY_PATH` when verifying fixes locally. The package-staging dir (`build/slang-<ver>-linux-x86_64/lib/`) holds a stale `libslang-compiler.so` that silently overrides the fresh build ([[wiki/learnings/1782733787106-slang-local-spirv-asm-verify-put-build-debug-lib-f.md]]).

**Vulkan build dependencies:** Building any RHI-dependent target on Linux requires `libx11-dev` (header `X11/Xlib.h`), even headless. `slang-rhi` CMakeLists.txt fetches Vulkan-Headers via FetchContent; the bundled headers unconditionally include `X11/Xlib.h` ([[wiki/learnings/1780330247261-CONSOLIDATED-slang-rhi-vulkan-build-needs-libx11-dev.md]]). The GPU environment may have NVIDIA hardware but no Vulkan loader — installing `libvulkan1` gives only software llvmpipe; real-GPU Vulkan needs the container to be provisioned with graphics device injection ([[wiki/learnings/1781698311286-this-environment-has-an-nvidia-gpu-nvidia-smi-work.md]], [[wiki/learnings/1781699613539-correction-installing-libvulkan1-does-not-enable-n.md]]).

**Runtime tests for new extensions:** A `COMPARE_COMPUTE` slang-test for a Vulkan extension requires a `SLANG_RHI_FEATURES` entry in slang-rhi. The `SLANG_RHI_FEATURES` X-macro is the bridge: one line auto-generates the `rhi::Feature` enum entry AND makes `-render-feature <name>` valid in slang-test. Cross-repo sequence: slang-rhi gate PR → bump slang-rhi pin → slang test-re-enable PR ([[wiki/learnings/1780969782467-slang-rhi-feature-gate-disabled-vulkan-runtime-tes.md]], [[wiki/learnings/1780970406624-slang-rhi-nv-extension-feature-gate-fp16-vector-at.md]], [[wiki/learnings/1782515089370-runtime-slang-test-for-a-new-vulkan-extension-is-g.md]]).

## Miscellaneous SPIR-V Pitfalls

- **VulkanBindShift C++ API:** `HLSLToVulkanLayoutOptions::Kind` encoding: u=0, s=1, t=2, b=3. Pack: `intValue0 = (kind << 24) | (set & 0xFFFFFF)`, `intValue1 = shift` ([[wiki/learnings/1780993682325-slang-vulkanbindshift-c-api-kind-encoding-u-0-s-1-.md]]).
- **SlangPy kernel abstraction:** Fully collapses to zero overhead in Slang SPIR-V at `-O3` — 0 `OpFunctionCall`, byte-identical to a hand-rolled kernel. Runtime index arithmetic (1 sdiv + 1 srem + strided loads) is design-inherent, not a codegen defect ([[wiki/learnings/1781017004302-slangpy-generated-kernel-abstraction-fully-folds-i.md]], [[wiki/learnings/1781050949927-measure-slangpy-generated-kernel-codegen-quality-g.md]]).
- **wgpu VUID errors come from Dawn/tint, not Slang:** VUID errors during `wgpu` variant tests are emitted by Dawn's internal tint regenerating SPIR-V from WGSL, not from Slang's emitter. Fingerprint: tint uses `uint` array-length constants; Slang uses `int` ([[wiki/learnings/1782499611532-slang-test-wgpu-compare-compute-vuid-errors-come-f.md]]).
- **Conditional<T,b> ICE:** `Conditional<T,b>` with a non-literal `hasValue` param survives `lowerConditionalType` and reaches emit as `makeConditionalValue` → ICE. Root cause is an upstream producer (autodiff, dynamic dispatch, or higher-order params) leaking an unresolved generic value param ([[wiki/learnings/1782485307814-conditional-lt-t-b-gt-ice-non-literal-flag-survive.md]]).
- **Stale prebuilt slangc:** Check `slangc -v`'s `<sha>` against `git rev-parse HEAD` before trusting compiled output. Function-static SPIR-V storage bugs are masked by inlining and NOT reproducible via `slangc -target spirv-asm` at default opt ([[wiki/learnings/1781708255374-stale-prebuilt-slangc-inlining-mask-spir-v-static-.md]]).

## Contradictions / Supersessions

- [[wiki/learnings/1781116222932-triaging-an-quot-add-a-spir-v-capability-bit-quot-.md]] originally advised gating on `isSPIRV(...)`, but this is incorrect — [[wiki/learnings/1781123971590-correction-spir-v-capability-emit-gating-use-impli.md]] supersedes it: gate on `targetCaps.implies(CapabilityAtom::spvFooEXT)`.
- [[wiki/learnings/1781643037138-correction-to-11631-version-root-cause-require-ato.md]] supersedes an earlier root-cause analysis of `[require(spirv_1_5)]` not raising the SPIR-V version, identifying the primary cause as the decoration only reaching the layout IR module.
- [[wiki/learnings/1782175454099-glsl-legalize-per-entry-point-system-value-decorat.md]] corrects [[wiki/learnings/1782173862922-glsl-legalize-per-entry-point-system-value-decorat.md]]: the inout double-attach is unreachable for depth specifically because depth semantics are output-only; both still recommend VaryingOutput gating as defense-in-depth.

---
**Source learnings (70):**
- [[wiki/learnings/1779612967874-slang-emit-spirv-builtin-var-cache-and-the-volatil.md]] — slang-emit-spirv builtin-var cache and the volatile-set cache-hit trap
- [[wiki/learnings/1779617050641-slang-spirv-asm-operand-builtinvar-is-hoistable-co.md]] — IRSPIRVAsmOperandBuiltinVar is hoistable — cross-stage builtin refs always collapse to one inst
- [[wiki/learnings/1779617068760-slang-emit-spirv-extra-memoryaccess-word-grammar-b.md]] — emitOperand(extraMask) after a user-supplied MemoryAccess word emits invalid SPIR-V
- [[wiki/learnings/1779621920622-slang-spir-v-entry-point-rename-auto-applies-only-.md]] — Slang SPIR-V entry-point rename: auto-applies only with >1 entry point
- [[wiki/learnings/1779962007180-spvdescriptorheapext-stride-is-opaque-for-as-load-.md]] — spvDescriptorHeapEXT stride is opaque for AS — load-type must drive runtime-array base type
- [[wiki/learnings/1780253722562-slang-spir-v-output-topology-hull-domain-arm-only-.md]] — Slang SPIR-V output-topology: hull/domain arm only handles a subset of OutputTopologyType
- [[wiki/learnings/1780310225210-slang-rhi-builds-headless-no-vulkan-sdk-gpu-via-cm.md]] — slang-rhi builds headless (no Vulkan SDK/GPU) via CMake FetchContent
- [[wiki/learnings/1780330247261-CONSOLIDATED-slang-rhi-vulkan-build-needs-libx11-dev.md]] — CONSOLIDATED: slang-rhi Vulkan build needs libx11-dev
- [[wiki/learnings/1780475494503-auditing-whether-a-vulkan-vuid-bug-propagates-to-t.md]] — Auditing whether a Vulkan VUID bug propagates to the CUDA backend
- [[wiki/learnings/1780643259838-constantbuffer-via-spvdescriptorheapext-sigsegvs-i.md]] — ConstantBuffer via spvDescriptorHeapEXT SIGSEGVs in SPIR-V emit
- [[wiki/learnings/1780663679121-slang-ci-a-test-slang-rhi-windows-gpu-failure-e-g-.md]] — Slang CI: a test-slang-rhi Windows-GPU failure is unrelated to compiler/test-only PRs
- [[wiki/learnings/1780729707220-spvdescriptorheapext-path-uses-kirop-spirvloaddesc.md]] — spvDescriptorHeapEXT path uses kIROp_SPIRVLoadDescriptorFromHeap, not IRCastDescriptorHandleToResource
- [[wiki/learnings/1780733286644-spvdescriptorheapext-path-fix-function-call-specia.md]] — spvDescriptorHeapEXT path — fix function-call specialization allowlists
- [[wiki/learnings/1780734760813-spvdescriptorheapext-specialization-fix-don-t-para.md]] — spvDescriptorHeapEXT specialization fix: don't parameterize the heap global
- [[wiki/learnings/1780768927407-slang-11496-spir-v-sigsegv-static-getformatinst-tr.md]] — Slang #11496 SPIR-V SIGSEGV — static getFormatInst() triage hypothesis was wrong
- [[wiki/learnings/1780769340224-spirvloaddescriptorfromheap-heap-operand-is-a-poin.md]] — SPIRVLoadDescriptorFromHeap heap operand is a pointer global at emit
- [[wiki/learnings/1780865902537-slang-spvdescriptorheapext-atomic-dest-validator-r.md]] — slang spvDescriptorHeapEXT: atomic-dest validator rejects heap texel pointers (E41403)
- [[wiki/learnings/1780869756318-descriptor-heap-texture-atomics-e41403-validator-g.md]] — Descriptor-heap texture atomics: E41403 validator gap (#11506) is separate from format-Unknown spirv-val (#11130)
- [[wiki/learnings/1780967438806-slang-spir-v-variable-pointers-cap-is-declared-fro.md]] — Slang SPIR-V variable-pointers cap is declared from value sites, not function signatures
- [[wiki/learnings/1780969782467-slang-rhi-feature-gate-disabled-vulkan-runtime-tes.md]] — Slang RHI feature gate + disabled Vulkan runtime test: the SLANG_RHI_FEATURES X-macro
- [[wiki/learnings/1780970406624-slang-rhi-nv-extension-feature-gate-fp16-vector-at.md]] — slang-rhi NV-extension feature gate (fp16-vector atomics) + Vulkan-Headers v1.4.318 retires bump caveat
- [[wiki/learnings/1780970685981-slang-spir-v-isolating-a-signature-only-variablepo.md]] — slang SPIR-V: isolating a signature-only VariablePointers cap repro
- [[wiki/learnings/1780993682325-slang-vulkanbindshift-c-api-kind-encoding-u-0-s-1-.md]] — Slang VulkanBindShift C++ API kind encoding (u=0,s=1,t=2,b=3)
- [[wiki/learnings/1781017004302-slangpy-generated-kernel-abstraction-fully-folds-i.md]] — SlangPy generated-kernel abstraction fully folds in slang SPIR-V (-O3)
- [[wiki/learnings/1781023718622-signature-derived-spir-v-variablepointers-must-gat.md]] — Signature-derived SPIR-V VariablePointers must gate on [noinline], not hasUses()
- [[wiki/learnings/1781039584587-when-planning-a-new-spir-v-opcode-check-terminator.md]] — When planning a new SPIR-V opcode, check terminator-ness
- [[wiki/learnings/1781050949927-measure-slangpy-generated-kernel-codegen-quality-g.md]] — Measure SlangPy generated-kernel codegen quality GPU-free via slangc SPIR-V opcode census
- [[wiki/learnings/1781114968928-slang-windows-vulkan-largebuffer-unit-test-crash-i.md]] — Slang windows-Vulkan LargeBuffer unit-test crash is a flake, not a regression
- [[wiki/learnings/1781116222932-triaging-an-quot-add-a-spir-v-capability-bit-quot-.md]] — Triaging an "add a SPIR-V capability bit" request
- [[wiki/learnings/1781120340432-adding-a-spir-v-capability-atom-to-slang-capdef-re.md]] — Adding a SPIR-V capability atom to Slang (capdef recipe)
- [[wiki/learnings/1781122622446-adding-a-spir-v-capability-atom-addendum-two-gener.md]] — Adding a SPIR-V capability atom — ADDENDUM (two generated docs + test -capability)
- [[wiki/learnings/1781123971590-correction-spir-v-capability-emit-gating-use-impli.md]] — CORRECTION: SPIR-V capability emit-gating — use implies(CapabilityAtom::spv*), NOT isSPIRV()
- [[wiki/learnings/1781129282277-slang-ci-windows-falcor-unknown-vcs-root-exit-1-is.md]] — Slang CI: windows falcor "Unknown VCS root" exit 1 is a Vulkan GPU crash artifact
- [[wiki/learnings/1781168370965-slang-synthesized-init-ctors-get-full-source-level.md]] — Slang: synthesized $init ctors get full source-level SPIR-V debug info
- [[wiki/learnings/1781176200581-slang-g2-spirv-asm-filecheck-tests-embedded-source.md]] — slang -g2 spirv-asm FileCheck tests: embedded-source self-match trap
- [[wiki/learnings/1781206942083-slang-user-defined-init-lacks-this-in-spir-v-debug.md]] — Slang: user-defined __init lacks `this` in SPIR-V debug info
- [[wiki/learnings/1781267563910-getnamefornamehint-feeds-c-like-emitter-identifier.md]] — getNameForNameHint feeds C-like emitter identifiers; ExtensionDecl is anonymous
- [[wiki/learnings/1781338076804-splitbuffer-bytebuffer-vulkan-gpu-hang-flake-falco.md]] — SplitBuffer ByteBuffer Vulkan GPU-hang flake (Falcor)
- [[wiki/learnings/1781568128097-spir-v-debugscope-must-be-variable-arity-null-ir-o.md]] — SPIR-V DebugScope must be variable-arity (null IR operand crashes buildEntryPointReferenceGraph)
- [[wiki/learnings/1781643037138-correction-to-11631-version-root-cause-require-ato.md]] — CORRECTION to #11631 version root cause: require atom stamped only on layout IR module
- [[wiki/learnings/1781698311286-this-environment-has-an-nvidia-gpu-nvidia-smi-work.md]] — This environment HAS an NVIDIA GPU despite CLAUDE.md saying "no GPU"
- [[wiki/learnings/1781699613539-correction-installing-libvulkan1-does-not-enable-n.md]] — Correction: installing libvulkan1 does NOT enable NVIDIA-GPU Vulkan
- [[wiki/learnings/1781708255374-stale-prebuilt-slangc-inlining-mask-spir-v-static-.md]] — Stale prebuilt slangc + inlining mask SPIR-V static-local bugs
- [[wiki/learnings/1781713084820-spir-v-function-static-state-loss-spirv-tools-priv.md]] — SPIR-V function-static state loss = SPIRV-Tools private-to-local
- [[wiki/learnings/1781714495665-slangc-target-spirv-asm-at-default-opt-does-run-sp.md]] — slangc -target spirv-asm at default opt DOES run spirv-opt (private-to-local)
- [[wiki/learnings/1781725591470-never-mutate-a-hoistable-spirvasmoperand-in-place-.md]] — Never mutate a hoistable SPIRVAsmOperand in place
- [[wiki/learnings/1781726667133-spir-v-asm-operand-legalization-hoistable-operands.md]] — SPIR-V asm-operand legalization: hoistable operands + foldable≠constant pitfalls
- [[wiki/learnings/1781799089141-slang-downstream-compiler-load-optional-spirv-opt-.md]] — slang downstream-compiler load: optional spirv-opt is fatal via real sink
- [[wiki/learnings/1781804734767-slang-downstream-compiler-absence-spirv-opt-slang-.md]] — Slang downstream-compiler absence (spirv-opt/slang-glslang) IS unit-testable
- [[wiki/learnings/1781825083619-ci-runs-slang-test-with-slang-run-spirv-validation.md]] — CI runs slang-test with SLANG_RUN_SPIRV_VALIDATION enabled
- [[wiki/learnings/1781905197543-slang-as-forcing-ray-query-only-capability-avoid-s.md]] — Slang AS: forcing ray-query-only capability (avoid SPV_KHR_ray_tracing)
- [[wiki/learnings/1781974573249-conditionally-requiring-a-spir-v-capability-for-a-.md]] — Conditionally requiring a SPIR-V capability for a stdlib spirv_asm intrinsic
- [[wiki/learnings/1782145409789-slang-g0-doesn-t-zero-spir-v-debug-info-opsource-o.md]] — slang -g0 doesn't zero SPIR-V debug info: OpSource/OpName bypass the IRDebug gating path
- [[wiki/learnings/1782152994624-slang-glslang-is-the-spir-v-backend-don-t-mask-its.md]] — slang-glslang is the SPIR-V backend — don't mask its load as optional
- [[wiki/learnings/1782165817624-slang-sv-depth-greater-less-equal-direct-spir-v-co.md]] — Slang SV_Depth{Greater,Less}Equal: direct SPIR-V correct, GLSL/via-GLSL drops directional mode
- [[wiki/learnings/1782211031715-slang-direct-spir-v-depth-mode-also-dropped-via-co.md]] — Slang direct-SPIR-V depth mode ALSO dropped via conflict-branch (dual depth-affecting vars)
- [[wiki/learnings/1782237919713-groupshared-by-reference-param-regresses-khronos-s.md]] — groupshared by-reference param regresses Khronos SPIR-V
- [[wiki/learnings/1782248897717-spv-khr-abort-transitively-requires-spv-khr-consta.md]] — SPV_KHR_abort transitively requires SPV_KHR_constant_data
- [[wiki/learnings/1782264945972-spvdescriptorheapext-unified-stride-per-type-array.md]] — spvDescriptorHeapEXT unified-stride: per-type arrays + symbolic-max construct
- [[wiki/learnings/1782267495019-triage-discriminator-slang-embedded-spirv-tools-vs.md]] — Triage discriminator: Slang embedded spirv-tools vs system Vulkan validation layer
- [[wiki/learnings/1782271381546-spirv-val-accepts-opspecconstantop-max-over-opaque.md]] — spirv-val accepts OpSpecConstantOp(max) over opaque OpConstantSizeOfEXT as an ArrayStrideIdEXT id
- [[wiki/learnings/1782322436550-spir-v-atomic-emit-has-two-address-space-gates-a-p.md]] — SPIR-V atomic emit has TWO address-space gates — a per-address-space fix must touch both
- [[wiki/learnings/1782322517394-slang-spir-v-emit-new-spv-enum-constants-resolve-f.md]] — Slang SPIR-V emit: new Spv* enum constants resolve from the SPIRV-Headers package
- [[wiki/learnings/1782346122322-slang-spir-v-atomic-emission-has-4-cross-layer-gat.md]] — Slang SPIR-V atomic emission has 4 cross-layer gates keyed on address space
- [[wiki/learnings/1782449605671-fp8-scalar-float-constants-abort-in-spirv-tools-co.md]] — fp8 scalar float constants abort in spirv-tools constant folding (width-8 gap)
- [[wiki/learnings/1782485307814-conditional-lt-t-b-gt-ice-non-literal-flag-survive.md]] — Conditional<T,b> ICE: non-literal flag survives lowerConditionalType to spirv-emit
- [[wiki/learnings/1782499611532-slang-test-wgpu-compare-compute-vuid-errors-come-f.md]] — slang-test wgpu COMPARE_COMPUTE VUID errors come from Dawn's internal tint, not Slang's SPIR-V emitter
- [[wiki/learnings/1782515089370-runtime-slang-test-for-a-new-vulkan-extension-is-g.md]] — Runtime slang-test for a new Vulkan extension is gated on slang-rhi harness support
- [[wiki/learnings/1782733787106-slang-local-spirv-asm-verify-put-build-debug-lib-f.md]] — slang local spirv-asm verify: put build/Debug/lib FIRST in LD_LIBRARY_PATH
- [[wiki/learnings/dashboard_slang-triage-1776263007885.md]] — SPIR-V issues require spirv-val, not just slangc exit code
_Catalog: [[wiki/index.md]]_
