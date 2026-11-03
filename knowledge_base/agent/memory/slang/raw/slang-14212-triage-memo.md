---
type: triage
---
# Triage: shader-slang/slang#14212 — slangc crashes with -incomplete-library -target spirv when an entry point calls an extern function inside a loop
Date: 2026-11-02 | bug | high | P2 | target-emit (SPIR-V) + downstream SPIRV-Tools optimizer
Reporter: tomaszbk (authorAssociation NONE), Slang 2026.19/2026.20 Windows. Duplicate: no.

## What's broken
`extern uint f(uint);` called from a compute entry point, compiled with `-incomplete-library -target spirv`.
slangc dies with SIGSEGV and prints nothing. The user wants SPIR-V with an Import linkage on `f`, for spirv-link.

## Repro (FACT, Linux, master 96a728c85, Release rebuilt 2026-11-02 23:45Z)
Reporter's c.slang (loop) / d.slang (no loop). `slangc X.slang -target spirv -entry main -stage compute -incomplete-library -O<n> -o X.spv`
| | -O0 | -O1 (default) | -O2 | -O3 |
| c (loop) | 0 | 139 | 139 | 139 |
| d (no loop) | 0 | 0 | 139 | 139 |
So the loop is NOT the root trigger. It is only what makes the default -O1 pipeline crash.
Without -incomplete-library: E45001 (correct).
Scratch files: /tmp/t14212 (c.slang, d.slang, valid.spvasm, min.spvasm, segv.so LD_PRELOAD backtrace helper).

## Codebase digest (FACT, backtraces via LD_PRELOAD SIGSEGV handler + addr2line on Debug libs)
1. All Slang IR passes finish (the last dump is checkUnsupportedInst). SPIR-V emit succeeds. The crash is inside the
   SPIRV-Tools optimizer that Slang runs: slang-glslang.cpp:554 glslang_optimizeSPIRV -> Optimizer::Run.
2. Crash site A (-O1, loop): DeadBranchElimPass::Process -> FixBlockOrder (external/spirv-tools/source/opt/dead_branch_elim_pass.cpp:455-482)
   -> ProcessReachableCallTree -> reorder_structured -> Function::ReorderBasicBlocksInStructuredOrder (function.cpp:279)
   reads blocks_[0] of the body-less `f`. EliminateDeadBranches guards IsDeclaration() (:425), but the FixBlockOrder lambdas
   do not. FixBlockOrder runs only when DBE changed something. The loop gives DBE something to change (Slang's
   `OpSwitch %int_0` wrapper / the loop's break branch).
3. Crash site B (-O2/-O3, any shape): LocalSingleStoreElimPass::LocalSingleStoreElim (local_single_store_elim_pass.cpp:35)
   runs `&*func->begin()` on the declaration. The DEFAULT (-O1) preset does not register LSSE; the HIGH preset does (slang-glslang.cpp ~470-520).
4. Upstream main is still affected. KhronosGroup/SPIRV-Tools main efadd8a7 (2026-11-02) has no diff in these files vs the pin b8c3b64b.
   A 25-line VALID module (spirv-val spv1.5 passes; OpCapability Linkage + `LinkageAttributes "f" Import`) crashes
   `spirv-opt --eliminate-dead-branches`. Its control (an unconditional branch, so DBE has nothing to change) passes. min.spvasm is below.
   Sweep over Slang's -O2 pass list run one pass at a time on valid.spv: only eliminate-dead-branches and eliminate-local-single-store crash.
   No upstream duplicate (searched ReorderBasicBlocksInStructuredOrder / FixBlockOrder / eliminate-dead-branches / Linkage).
   Upstream #6632 is a different DBE+unroll crash (Kernel, closed 2026-06).
5. Separate Slang gap (FACT): Slang emits NO `OpCapability Linkage` and NO `LinkageAttributes Import` for a user extern.
   The output of the "working" cases (d -O1, c -O0) is invalid SPIR-V. spirv-val says: "Function declaration (id N) must have a
   LinkageAttributes decoration with the Import Linkage type." It is not spirv-link-able.
   slang-emit-spirv.cpp:6926-6950 emits LinkageAttributes only for kIROp_DownstreamModule{Export,Import}Decoration. Those are the
   precompiled-module path. The Import one is added only by removeAvailableInDownstreamModuleDecorations (slang-ir-redundancy-removal.cpp:387).
   For the precompiled path, spirv-link resolves the declarations before spirv-opt runs, so it never hits the crash.
   The Import case calls `findDecoration<IRExportDecoration>()->getMangledName()`. On an `[import]`-only func (user extern)
   that is null. Reusing it as-is would null-deref, so use IRLinkageDecoration / IRImportDecoration for the name.
   The IR at emit for `f`: `[UserExtern] [import("_S1fp1pi_uu")] func %f : Func(UInt, UInt);` (no body).
6. Side gap (FACT): `-target spirv-asm -incomplete-library` still reports E45001. doesTargetAllowUnresolvedFuncSymbol
   (slang-ir-link.cpp:1889-1916) lists SPIRV and DXILAssembly but not SPIRVAssembly. This matters for test authoring: a
   filecheck test on spirv-asm cannot cover this until that case is added.
7. shouldRunSPIRVValidation (slang-emit.cpp:3496) already skips validation for -incomplete-library "containing linkage
   decorations". needsOptimization is computed at slang-emit.cpp:3625.

## Candidate approaches
### A: Upstream SPIRV-Tools fix + submodule bump
- Where: dead_branch_elim_pass.cpp FixBlockOrder lambdas; local_single_store_elim_pass.cpp:35. A central alternative is to skip
  declarations in IRContext::ProcessCallTreeFromRoots (ir_context.cpp:1105).
- Delta: spirv-opt tolerates imported declarations. Slang bumps external/spirv-tools (.gitmodules allows pinning an upstreamed-but-unmerged PR, see PR #11063).
- Tradeoffs: this is the true root of the crash, but it needs an external filing (operator go-ahead) and upstream latency. Other passes may hide more such derefs.
### B: Slang skips spirv-opt while function imports remain (crash fix in Slang)
- Where: slang-emit.cpp:3625 (needsOptimization), or glslang_optimizeSPIRV. Condition: the module still has body-less imported IRFuncs after downstream linking.
  Do not use "-incomplete-library is set" as the condition: that would de-optimize precompiled/export library outputs.
- Delta: no crash at any -O level. An incomplete module is optimized after spirv-link by the consumer. The precompiled path already links before optimizing.
- Tradeoffs: small, local, testable in CI today. It loses pre-link optimization for import-bearing modules (low value: they are not whole programs).
  It is defensive against a third-party bug, so keep it until A lands. Slang cannot filter spirv-opt passes per function.
- Risk: low. It only changes behavior for modules that crash today.
### C: Emit SPIR-V Import linkage for user extern declarations
- Where: slang-emit-spirv.cpp emitFuncDeclaration / decoration switch :6939. Add requireSPIRVCapability(Linkage) and
  `LinkageAttributes "<mangled>" Import` for body-less funcs with IRImportDecoration (+UserExtern) under -incomplete-library.
- Delta: the output becomes valid SPIR-V and spirv-link-able. This is the reporter's Expected.
- Tradeoffs: it does NOT fix the crash alone (the valid module still crashes spirv-opt), so it needs B or A.
  The name contract is the mangled name; the export side is #6607 (E57004). They share the gap: Slang emits SPIR-V linkage only for precompiled-module decorations.
### D: Diagnose instead of crash
- Under -incomplete-library + SPIR-V, unresolved user externs give a diagnostic. This contradicts the flag's purpose ("Allow generating code
  from incomplete libraries with unresolved external functions"). Rejected unless a maintainer prefers it.

## Recommended path
B + C in one PR. Name: "skip pre-link spirv-opt for import-bearing modules + emit Import linkage for user externs".
Why: B removes the crash at every -O level now. C makes the output what the reporter asked for, and makes the currently "working"
case valid SPIR-V. A is proposed upstream in parallel via the operator. After the bump, B can be relaxed.
Also add SPIRVAssembly to doesTargetAllowUnresolvedFuncSymbol, so spirv-asm filecheck tests work. It is a one-line consistency fix that the test needs.
Repro: slangc c.slang -target spirv -entry main -stage compute -incomplete-library [-O1|-O2] -o c.spv ; also d.slang -O2.
Acceptance: (1) c.slang and d.slang exit 0 at -O0..-O3. (2) The output has `OpCapability Linkage` and
`OpDecorate %f LinkageAttributes "_S1fp1pi_uu" Import`, and passes spirv-val --target-env spv1.5. (3) Without
-incomplete-library, E45001 is unchanged. (4) tests/library/* precompiled-SPIR-V tests are unchanged (optimization is still applied there).
(5) A new regression test under tests/library/ (filecheck on spirv-asm, loop + no-loop, -O2).
If C turns out to be entangled with the #6607 naming design, ship B (+ spirv-asm case) and report C as a follow-up.

## Proposed upstream SPIRV-Tools issue (for the operator; NOT filed)
Title: spirv-opt: --eliminate-dead-branches and --eliminate-local-single-store crash on an imported (body-less) function in the call tree
Body: The valid module below (spirv-val --target-env spv1.5 passes) segfaults `spirv-opt --eliminate-dead-branches`.
DeadBranchElimPass::FixBlockOrder runs ProcessReachableCallTree with reorder_structured. That calls
Function::ReorderBasicBlocksInStructuredOrder on the Import-linkage declaration `%f`, which reads blocks_[0] of an empty
vector (function.cpp:279). EliminateDeadBranches already returns early for IsDeclaration(), but the FixBlockOrder lambdas do
not. The same module also crashes `--eliminate-local-single-store` (LocalSingleStoreElim derefs func->begin(),
local_single_store_elim_pass.cpp:35). Reproduces on main efadd8a7. Suggested fix: guard IsDeclaration() in both FixBlockOrder
lambdas and in LocalSingleStoreElim. Alternatively, skip declarations in ProcessCallTreeFromRoots.
```
OpCapability Shader
OpCapability Linkage
OpMemoryModel Logical GLSL450
OpEntryPoint GLCompute %main "main"
OpExecutionMode %main LocalSize 1 1 1
OpDecorate %f LinkageAttributes "f" Import
%void = OpTypeVoid
%fnvoid = OpTypeFunction %void
%uint = OpTypeInt 32 0
%uint_0 = OpConstant %uint 0
%bool = OpTypeBool
%true = OpConstantTrue %bool
%fnuint = OpTypeFunction %uint %uint
%f = OpFunction %uint None %fnuint
%x = OpFunctionParameter %uint
OpFunctionEnd
%main = OpFunction %void None %fnvoid
%entry = OpLabel
OpSelectionMerge %merge None
OpBranchConditional %true %then %merge
%then = OpLabel
%r = OpFunctionCall %uint %f %uint_0
OpBranch %merge
%merge = OpLabel
OpReturn
OpFunctionEnd
```
`spirv-as m.spvasm -o m.spv && spirv-val m.spv && spirv-opt --eliminate-dead-branches m.spv -o o.spv` -> SIGSEGV.
(The LSSE crash needs a function-scope OpVariable in main; /tmp/t14212/valid.spvasm shows it.)

## Workaround for the reporter
`-O0` avoids the crash (verified exit 0). But the output still lacks Import linkage, so it is not valid SPIR-V and cannot be spirv-linked (gap 5).

## Sources
- DeepWiki: user externs get no LinkageAttributes, only DownstreamModule* do. needsOptimization is driven only by -O level and -Xspirv-opt.
- Related slang issues: #6607 (export side, E57004), #12385, #12371 (linkage validation), #14200 (body-less __extern_cpp entry point), #12372 (spirv-opt assert on invalid Slang SPIR-V).
- Shared learning: LD_PRELOAD SIGSEGV backtrace trick (no gdb in container).
