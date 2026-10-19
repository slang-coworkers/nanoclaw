---
title: "Slang SPIR-V entry points, varyings, and execution modes"
type: concept
group: slang-backends
tags: [spirv, entry-point, execution-mode, varyings, location, SV_Target, depth, tessellation, spirv_asm, interpolateAt, module-version, binding-shift]
source_count: 8
---

# Slang SPIR-V entry points, varyings, and execution modes

How the SPIR-V backend assigns varying locations, emits depth and topology execution modes, lets `spirv_asm` reference entry points, and shares module-scope interface variables between entry points. Entry-point renaming and the attribute-to-execution-mode recipe are on [[wiki/concepts/slang-backends-spirv.md]]; GLSL-side varying legalization is on [[wiki/concepts/slang-backends-glsl-entry-point-and-varying-legalization.md]].

## TL;DR

- `SV_Target<N>` is the only varying semantic whose suffix is an absolute GLSL/SPIR-V location. User-defined suffixes are names, so locations follow declaration order; never genericize suffix→location (that path is WGSL/Metal-only).
- One module-scope `Input` variable may serve entry points of different stages (a vertex EP reading it, a fragment EP interpolating it). A sharing check compares locations, never stages.
- A new IR instruction or decoration needs a `k_maxSupportedModuleVersion` bump; the stable-names CI check does not catch a missing one.
- The direct SPIR-V and GLSL paths diverge on depth execution modes: GLSL drops the directional mode, and the direct path collapses to `DepthReplacing` when two depth builtins coexist. Check both with `-emit-spirv-via-glsl`.
- The hull/domain output-topology arm handles only a subset; `Line` falls through to the mesh arm and emits an invalid `OutputLinesEXT`.
- In `spirv_asm`, `__entryPoint` is special-cased only for `OpExecutionMode`; `OpExecutionModeId __entryPoint` ICEs (E99997). Write `OpExecutionModeId $main <Mode> $specConst` inside each entry point (direct SPIR-V only).
- `VulkanBindShift` through the C++ API packs `kind << 24 | set` with u=0, s=1, t=2, b=3.

## Varying locations

`SV_Target<N>` is the only varying semantic that both consumes a GLSL/SPIR-V location and carries a suffix naming an absolute slot. In `processEntryPointVaryingParameter` (`slang-parameter-binding.cpp` ~:2064), it alone takes the `Output` layout; every other `SV_`/`NV_` semantic is a builtin with direction mask 0. In #11944, `systemValueSemanticIndex` is stored but never read, so an out-of-order `SV_TargetN` gets its location from declaration order. User-defined suffixes (TEXCOORD0, COLOR1) are name disambiguators: GLSL/SPIR-V assign those locations in declaration order, and HLSL matches stages by name. Deriving locations from those suffixes would break inter-stage matching, so the fix applies to SV_Target only. The `SV_TARGET<N>→LOCATION_<N>` translation in `fixFieldSemanticsOfFlatStruct` (`slang-ir-legalize-varying-params.cpp:3730`) runs only for Metal and WGSL. GLSL/SPIR-V read the VarLayout `index` in emit (`slang-emit-spirv.cpp:3445-3465`) ([SV_Target-N is the only absolute-location semantic](../learnings/1784321038825-slang-sv-target-n-is-the-only-varying-semantic-enc.md)).

**One Input variable can serve entry points of different stages (#13687, PR #13726).** When several entry points must share one real module-scope `Input` variable, for example a global passed to GLSL `interpolateAt*`, which needs the address of an Input variable, check only that its location matches. Do not check the stage: one `OpVariable Input` may be listed by a vertex entry point that reads it directly and by a fragment entry point that interpolates it. That shape was valid on master, and a stage-equality check wrongly rejected it. To make an AST-only call-site requirement visible to IR passes, lower the attribute (`[__GLSLRequireShaderInputParameter(n)]`) to an IR decoration on the function; a trigger such as "the global's address is passed to any call" also fires on valid `__constref` calls. The same PR added an IR decoration, which also needs `k_maxSupportedModuleVersion` incremented in `source/slang/slang-ir.h` with a one-line comment beside the existing ones (`docs/design/backwards-compat-for-ir-modules.md`, "When to Update Module Version"); the stable-names CI check does not catch a missing bump, and peer review did. Run that check locally by building lua out of tree (`cp -r external/lua /tmp/lua && make -C /tmp/lua MYCFLAGS=-DLUA_USE_POSIX MYLIBS=`), then `/tmp/lua/lua extras/check-ir-stable-names.lua check` ([adding an IR opcode needs a module-version bump; one SPIR-V Input var can serve EPs of different stages](../learnings/1792218658955-slang-adding-an-ir-opcode-needs-a-module-version-b.md)). The full nine-site recipe for a new entry-point attribute and execution mode is on [[wiki/concepts/slang-backends-spirv.md]].

## Depth and topology execution modes

**Depth.** For `SV_DepthGreaterEqual`/`SV_DepthLessEqual`, the direct SPIR-V path emits `DepthReplacing` plus `DepthGreater`/`DepthLess`, while the GLSL/via-GLSL path drops the directional mode. On the direct path, when two depth-affecting builtins coexist (e.g. `SV_Depth` + `SV_DepthGreaterEqual`), `maybeEmitEntryPointDepthReplacingExecutionMode` collapses to `DepthReplacing` only, through its `else if (mode != thisMode)` conflict branch ([GLSL drops directional mode](../learnings/1782165817624-slang-sv-depth-greater-less-equal-direct-spir-v-co.md), [direct path also drops via conflict branch](../learnings/1782211031715-slang-direct-spir-v-depth-mode-also-dropped-via-co.md)). In `slang-ir-glsl-legalize.cpp`, gate a new entry-point system-value decoration on `kind == LayoutResourceKind::VaryingOutput`, as `sv_position` does (~478-498), and add the op to `isSimpleDecoration` (`slang-ir.cpp` ~86) so duplicates collapse. For depth this is only defense-in-depth: depth semantics are setter-only in `core.meta.slang` (E30702), so the inout double-attach can't happen ([VaryingOutput gating](../learnings/1782175454099-glsl-legalize-per-entry-point-system-value-decorat.md)).

**Output topology (hull/domain).** The `kIROp_OutputTopologyDecoration` hull/domain arm handles only TriangleCW/TriangleCCW/Point. `Line` falls through to the mesh arm and emits `OutputLinesEXT`, which is invalid on tessellation stages. For isoline, `Line` should be a no-op because `OpExecutionMode Isolines` already implies it, and the fallback needs a stage guard ([hull/domain topology subset](../learnings/1780253722562-slang-spir-v-output-topology-hull-domain-arm-only-.md)).

## `spirv_asm` execution modes: `__entryPoint` works only for `OpExecutionMode`

In `spirv_asm`, `OpExecutionMode __entryPoint <Mode> ...` is special-cased (`slang-emit-spirv.cpp` ~11924): it is emitted once for EVERY entry point that references the enclosing function, so it works from a shared helper. `OpExecutionModeId` is not special-cased. It takes the generic path, where `__entryPoint` hits `SLANG_UNREACHABLE` "Unhandled case in emitSPIRVAsm" (E99997). For Id modes such as `OpacityMicromapIdKHR`, write `OpExecutionModeId $main <Mode> $specConst` inside each entry point: `$main` is an ordinary function-value reference emitted verbatim, and a `[vk::constant_id(N)] const bool` referenced as `$name` becomes an `OpSpecConstant` with SpecId that spirv-val accepts as the Id operand. This works on direct SPIR-V only; `-target glsl` and `-emit-spirv-via-glsl` ICE on these blocks ("unexpected IR opcode" / "circularity during codegen"). DeepWiki says `__entryPoint` works for execution modes and is tested; that is wrong for `OpExecutionModeId`, and `tests/` has no such test (#13438, master 6ba151dcf) ([spirv_asm OpExecutionModeId: $entryName works, __entryPoint ICEs](../learnings/1791207151155-spirv-asm-opexecutionmodeid-entryname-works-entryp.md)).

## Binding shifts through the API

**VulkanBindShift C++ API:** `HLSLToVulkanLayoutOptions::Kind` encoding: u=0, s=1, t=2, b=3. Pack: `intValue0 = (kind << 24) | (set & 0xFFFFFF)`, `intValue1 = shift` ([Slang VulkanBindShift C++ API kind encoding (u=0,s=1,t=2,b=3)](../learnings/1780993682325-slang-vulkanbindshift-c-api-kind-encoding-u-0-s-1-.md)).

## See also

- [[wiki/concepts/slang-backends-spirv.md]] — emitter overview: entry points, builtin variables, descriptor-heap specialization, VariablePointers, atomics
- [[wiki/concepts/slang-backends-spirv-debug-function-info.md]] — DebugFunction / DebugFunctionDefinition records
- [[wiki/concepts/slang-backends-spirv-spirv-opt-and-optimization-levels.md]] — slang-glslang loading, -O levels, spirv-opt aborts, folding/unroll/CSE limits
- [[wiki/concepts/slang-backends-spirv-precise-and-nocontraction.md]] — `precise`, NoContraction, fp-mode, spirv-opt reassociation
- [[wiki/concepts/slang-backends-spirv-debug-info-emission.md]] — -g levels, DebugSource/DebugLine, debug types and variables, OpName
- [[wiki/concepts/slang-backends-spirv-capabilities-and-version-gating.md]] — capdef atoms, capability/extension emission, version header, `[require]` enforcement
- [[wiki/concepts/slang-backends-spirv-descriptor-handles-and-heap.md]] — DescriptorHandle load coalescing, NonUniform, bindless width, descriptor-heap ABI
- [[wiki/concepts/slang-backends-spirv-emit-and-legalization-defects.md]] — logical pointers in composites, opaque copies, constant/scalar emit gaps, legalize diagnostics
- [[wiki/concepts/slang-backends-spirv-validation-testing-and-environment.md]] — spirv-val, pre/post-spirv-opt validity, stale binaries, runtime tests, Vulkan CI flakes

**Source learnings (8):**
- [slang SV_Target-N is the only varying semantic encoding an absolute GLSL/SPIR-V location; user-defined suffix→location is WGSL/Metal-only](../learnings/1784321038825-slang-sv-target-n-is-the-only-varying-semantic-enc.md)
- [Slang: adding an IR opcode needs a module-version bump; one SPIR-V Input var can serve EPs of different stages](../learnings/1792218658955-slang-adding-an-ir-opcode-needs-a-module-version-b.md)
- [Slang SV_Depth{Greater,Less}Equal: direct SPIR-V correct, GLSL/via-GLSL drops directional mode](../learnings/1782165817624-slang-sv-depth-greater-less-equal-direct-spir-v-co.md)
- [Slang direct-SPIR-V depth mode ALSO dropped via conflict-branch (dual depth-affecting vars)](../learnings/1782211031715-slang-direct-spir-v-depth-mode-also-dropped-via-co.md)
- [GLSL legalize: per-entry-point system-value decorations must gate on VaryingOutput (inout double-attach)](../learnings/1782175454099-glsl-legalize-per-entry-point-system-value-decorat.md)
- [Slang SPIR-V output-topology: hull/domain arm only handles a subset of OutputTopologyType](../learnings/1780253722562-slang-spir-v-output-topology-hull-domain-arm-only-.md)
- [spirv_asm `OpExecutionModeId`: `$main` works, `__entryPoint` ICEs (only `OpExecutionMode` is special-cased); direct SPIR-V only (#13438)](../learnings/1791207151155-spirv-asm-opexecutionmodeid-entryname-works-entryp.md)
- [Slang VulkanBindShift C++ API kind encoding (u=0,s=1,t=2,b=3)](../learnings/1780993682325-slang-vulkanbindshift-c-api-kind-encoding-u-0-s-1-.md)
