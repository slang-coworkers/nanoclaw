---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787610264809-74zrzx
written_at: 2026-08-24T22:31:47.697Z
---

# Slang FP interface tower — where IFloat conformance actually lives (core.meta.slang)

For shader-slang/slang#12591 (FP interface tower: IFloatingPoint/IReal/IScalarReal, IFloat→alias). Investigating the current surface in source/slang/core.meta.slang, the load-bearing facts:

- **`IFloat` (core.meta.slang:304)** refines `IArithmetic, IDifferentiable` (NOT IComparable directly — it gets it via IArithmetic:IComparable at :140). Requirements: `__init(float)`, `toFloat()`, add/sub/mul/div/mod/neg (all re-declared `[Differentiable]`), `__init(This)`, and `scale<T:__BuiltinFloatingPointType>(T)`. Every requirement is `[Differentiable]`.
- **`__BuiltinFloatingPointType` (:922)** is `[sealed][builtin][TreatAsDifferentiable]`, refines `__BuiltinRealType, IFloat, IFloatingPointCoopElement`, and adds exactly ONE own requirement: `static This getPi()`. Doc comment (:915-918) says "To define generic functions that work with both scalar and vector types, use `IFloat` instead."
- **Scalar float/half/double satisfy IFloat inline** in the codegen struct body at :1307-1345 (getPi + all arithmetic __intrinsic_op members + Differential/dzero/dadd). The `__Builtin*` conformance list is attached at :1137-1179.
- **vector/matrix conform to IFloat ONLY when element T:__BuiltinFloatingPointType** — explicit `extension vector<T,N> : IFloat` at :2394 and `extension matrix<T,N,M,L> : IFloat` at :2459. IDifferentiable conformance for vector/matrix is separate (:2438, :2502).
- **All transcendentals (pow/exp/log/sqrt/sin/cos/tan/... ~74 names) are FREE functions constrained to `__BuiltinFloatingPointType`, not interface requirements** — hlsl.meta.slang, 86 scalar generic decls. Each has scalar/vector/matrix overloads; vector/matrix fall back to VECTOR_MAP_UNARY/MATRIX_MAP_BINARY element-wise (hlsl.meta.slang:7389-7405). Only `getPi()` is an actual interface requirement; `T.getPi()` is called inside degrees/radians/sinpi/cospi.
- **Aliasing IFloat blast radius is small**: 18 `\bIFloat\b` hits in *.meta.slang, most are doc/generic-constraint. Load-bearing: def(304), extension conformances(2394,2459), __Builtin refine(922), and a C++ codegen STRING array `arithmeticInterfaces[]={"IArithmetic","IFloat"}` at :3605 that generates operator +-*/%- overloads — a typealias name must resolve in that generic-constraint position.
- **Meta mechanism**: `${ C++ $}` template blocks + `$(...)` value splices, processed by the `slang-generate` host tool (tools/slang-generate) wired in source/slang-core-module/CMakeLists.txt:44. Regen after edits: `cmake -E touch` the file, then targets `generate_core_module_headers` (defined slang-core-module/CMakeLists.txt:186) + `slangc`.
- **No `typealias`-of-interface exists yet** in any *.meta.slang (only typealias of concrete types like ImmutablePtr at core.meta.slang:1508). BuiltinRequirementKind enum is at slang-ast-support-types.h:1818 and does NOT include Add/Sub/Mul (those are plain __intrinsic_op members, not magic requirements).
- Legacy spec proposal (shader-slang/spec proposals/legacy/001-basic-interfaces.md) separates ISpecialFunctions:IFloatingPoint because "many platforms support floating-point types like `double` without also having full support for special functions on those types," and notes users get tripped up that ops on __BuiltinFloatingPointType aren't available since the __ interfaces exist only to support the core module.
