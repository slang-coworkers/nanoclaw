---
type: triage
---
# Triage: shader-slang/slang#14348 — CoopMat rejects specialization constants as matrix dimensions (E39999) on SPIR-V
Date: 2026-11-05 | feature-request | medium | P2 | frontend (semantic check) + target-emit SPIR-V
Reporter: zainsharief (external, NONE). Duplicate: no. Related: #6840 (orig ask, closed by #7121), #7855/#7834 (restriction), #14290 (spec-const E31226 false positive).

## What's broken / being requested
`linalg::CoopMat<half, MemoryScope.Subgroup, BLOCK, BLOCK, MatrixA>` with `[[vk::constant_id(0)]] const uint BLOCK`
(or `[SpecializationConstant]`) fails E39999 at both BLOCK args. Ask: accept spec constants as CoopMat Rows/Cols on
SPIR-V and emit `OpTypeCooperativeMatrixKHR` with the OpSpecConstant ids.

## Repro (master 04d2726db, local Release build)
`slangc repro.slang -target spirv -entry main -stage compute -o repro.spv` → E39999 x2 (vk::constant_id and
[SpecializationConstant]); `static const` compiles. Also fails for `struct S<let K:uint>; S<N>` and `vector<float,N>`
→ general rule, not CoopMat-specific. Spec-const-sized array of CoopMat works (OpTypeArray %coopmat %OpSpecConstantOp).
Generic INFERENCE already binds a spec const: `float sum<let K:int>(float a[K])` called with `float a[N]` compiles (loop
bound OpSLessThan %N) — the gate only covers explicit generic args.

## SPIR-V spec check — claim TRUE
SPV_KHR_cooperative_matrix: "Rows must be a constant instruction with scalar 32-bit integer type" (same for Columns,
Scope, Use); overview: "the dimensions of the cooperative types can be specialized via specialization constants".
SPIR-V core 2.2: "Constant Instruction: either a specialization-constant instruction or a non-specialization constant
instruction" (OpConstant* / OpSpec*). GLSL_KHR_cooperative_matrix: "scope, rows, and columns ... can be ...
specialization constant expressions". spirv-val ValidateTypeCooperativeMatrix uses spvOpcodeIsConstant (includes OpSpec*).
Vulkan validates post-specialization against vkGetPhysicalDeviceCooperativeMatrixPropertiesKHR (VUID ...-10163).

## Codebase digest (file:line pointers)
- Gate: `slang-check-overload.cpp:306-313` — `argFoldingKind = LinkTime` unless `isArrayDecl` (:290-298, array magic type).
- `slang-check-expr.cpp:2817-2839` tryConstantFoldDeclRef: spec-const decl folds to DeclRefIntVal only for
  `ConstantFoldingKind::SpecializationConstant`; else nullptr → E39999 (`slang-check-expr.cpp:3434`; diag def
  `slang-diagnostics.lua:4290`). Also `ExtractGenericArgVal`/`InstantiateGenericType` hard-code LinkTime (check-type.cpp:203-243).
- History: #7121 (kaizhangNV, 2025-05, b325474c4) allowed spec consts for all generic value params; #7855 (csyonghe,
  2025-07, 9d47a3529) narrowed to arrays only. csyonghe rationale:
  https://github.com/shader-slang/slang/pull/7855#discussion_r2221061276 and #discussion_r2221063435 —
  "spec-constants are specialized by the downstream compiler where slang compiler is no longer in context, so we can't
  possibly allow any generic functions or types that are depend on specialization constants before generating spirv."
- CoopMat decl: `hlsl.meta.slang:30116-30127` `__intrinsic_type(kIROp_CoopMatrixType)`, `<T, let S, let M:int, let N:int, let R>`,
  conforms to IArray<T>. Load/Store are spirv_asm `$$CoopMat<T,S,M,N,R>` (:30965, :31004); M/N used as values only in
  GetRowCount/GetColumnCount (:30483-30493) and `Reduce2x2` type `M / 2` (:30585).
- IR: `CoopMatrixType` operands elementType/scope/rowCount/columnCount/matrixUse (`slang-ir-insts.lua:707-716`).
  Spec-const rate already modeled (lower-to-ir.cpp:3364-3370, 1936-1949; specialize.cpp:146).
- SPIR-V emit: `slang-emit-spirv.cpp:2691-2725` unchecked `static_cast<IRIntLit*>` on scope/rows/cols/use → UB for a
  non-literal. Array path `:2835-2855` passes the IRInst element count to emitOpTypeArray (ensureInst → OpSpecConstant /
  OpSpecConstantOp). `emitOpTypeCoopMat` (`slang-emit-spirv-ops.h:167-186`) is a template — can take IRInst operands.
- Metadata: `slang-ir-metadata.cpp:676-687` CoopMatMulAdd requires IntLit rows/cols ("must be integer literals") — runs on
  SPIR-V too (slang-emit.cpp:2940-2949). Reflection type at metadata.cpp:435-437 silently skips non-literal dims.
- Other targets need literals: HLSL `slang-emit-hlsl.cpp:2021-2028` RELEASE_ASSERT; CUDA `slang-emit-cuda.cpp:1770-1773`
  static_cast + WMMA shape pick (:1795); Metal `slang-emit-metal.cpp:1302-1303` getIntVal → SLANG_UNEXPECTED.
  GLSL: no coopmat emit (capability `cooperative_matrix` = spv|cuda|sm_6_10|metal, capdef:1442).
- Tests: `tests/cooperative-matrix/` (~60 files, none with spec consts); `tests/spirv/spec-constant-generic.slang`,
  `tests/spirv/spec-constant-sized-array-{1..4}.slang`.

## Candidate approaches
### Approach A: opt-in allow-list for CoopMat Rows/Cols (recommended, needs csyonghe sign-off)
- Where: replace `isArrayDecl` (`slang-check-overload.cpp:290-313`) with a check that also admits CoopMat (marker attribute
  on the decl or its M/N params, or the `kIROp_CoopMatrixType` intrinsic-type modifier); SPIR-V emit `:2712-2720` pass
  rowCount/columnCount through ensureInst like OpTypeArray; `slang-ir-metadata.cpp:676-687` skip the literal-only
  compatibility check (or compare inst identity) for non-literal dims; HLSL/CUDA/Metal: clean diagnostic instead of
  assert/UB/SLANG_UNEXPECTED when dims are non-literal.
- Behaviour delta: CoopMat<..., SpecConst, SpecConst, ...> compiles on SPIR-V; emits %N as Rows/Cols.
- Tradeoffs: narrow blast radius; CoopMat member bodies are intrinsics, so no compile-time branching on M/N.
- Risk: carves an exception to the #7855 rule; user generics over CoopMat dims get spec-const args (already true for arrays
  via inference); Scope/Use stay literal (SPIR-V allows spec consts there too, but not asked).
### Approach B: restore #7121 behaviour (spec-const args for all generic value params on SPIR-V)
- Where: `slang-check-overload.cpp:309` default to SpecializationConstant.
- Tradeoffs/Risk: broad; vector<T,N>/matrix need literal counts in SPIR-V (OpTypeVector takes a literal); Conditional<T,b>
  / layout / parameter-binding need concrete values; contradicts the maintainer's stated reason. Not recommended.
### Approach C: keep the restriction; improve the diagnostic + document workarounds
- Where: E39999 site `slang-check-expr.cpp:3434` / a dedicated diag when the arg is a spec constant ("spec constants are
  only allowed as array sizes"); docs.
- Workaround: one kernel per size (reporter's current), or link-time constants (`extern static const`, LinkTime folding is
  accepted for generic args — unverified end-to-end for CoopMat via slangc CLI).
- Tradeoffs: zero codegen risk; does not meet the ask. Cheap to do regardless of A.

## Recommended path
Park for maintainer direction (csyonghe owns the #7855 rule). If approved: Approach A.
- Hypothesis: `isArrayDecl`-only SpecializationConstant folding (`slang-check-overload.cpp:309-313`) rejects the args;
  SPIR-V emit (`slang-emit-spirv.cpp:2712-2720`) and metadata (`slang-ir-metadata.cpp:676-687`) also assume IntLit dims.
- Repro: `slangc repro.slang -target spirv -entry main -stage compute -o repro.spv` (issue body).
- Acceptance: repro compiles; SPIRV shows `OpTypeCooperativeMatrixKHR %half %scope %N %N %use` with `%N = OpSpecConstant`;
  `SLANG_RUN_SPIRV_VALIDATION=1` passes; mulAdd with spec-const M/N/K compiles; GPU `-vk` COMPARE_COMPUTE on L40S with
  spec const at default value; HLSL/CUDA/Metal give a clean diagnostic (no assert); new test under
  `tests/cooperative-matrix/`; existing `tests/cooperative-matrix/` and `tests/spirv/spec-constant-*` still pass.

## Sources
- DeepWiki: generic value args use LinkTime folding; only array-magic generics use SpecializationConstant; CoopMat emit
  would reuse the array spec-const mechanism.
- SPV_KHR_cooperative_matrix https://github.khronos.org/SPIRV-Registry/extensions/KHR/SPV_KHR_cooperative_matrix.html
- GLSL_KHR_cooperative_matrix https://raw.githubusercontent.com/KhronosGroup/GLSL/main/extensions/khr/GLSL_KHR_cooperative_matrix.txt
- SPIRV-Tools validate_type.cpp / opcode.cpp (spvOpcodeIsConstant includes OpSpec*)
- PRs #7121, #7855; issues #6840, #7834, #14290
