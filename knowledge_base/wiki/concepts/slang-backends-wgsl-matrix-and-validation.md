---
title: "Slang WGSL emit: matrix-operator validity, template-list ambiguity, and GPU-free naga validation"
type: concept
group: slang-backends
tags: [wgsl, naga, naga-wasm, validation, matrix, negation, int64, legalizeMatrixTypes, template-list, emit, slang]
source_count: 5
---

# Slang WGSL emit: matrix-operator validity, template-list ambiguity, and GPU-free naga validation

Slang's WGSL emitter (`slang-emit-wgsl.cpp`) can produce text that compiles with rc 0 but is rejected by wgpu/naga. Two families recur: expressions that are legal in the Metal/HLSL shapes the emitter mirrors but not in WGSL (matrix negation, non-float matrices), and comma-separated lists that WGSL's template-list grammar mis-parses. Both can be checked without a GPU. The broader WGSL backend lives on [[wiki/concepts/slang-backends-wgsl-metal.md]]; WGSL via Tint is on [[wiki/concepts/slang-backends-f0909b0-glsl-wgsl-bindless.md]].

## TL;DR

- **GPU-free WGSL check: `npm install naga-wasm@30.2.0`, then `validate(parseWgsl(src))`.** It throws on parse or validation errors, needs no Rust toolchain, and works on node 22 despite a node >=24.12 warning.
- **WGSL template-list ambiguity (§3.9):** in `f(a < b, a > b)` the `a <` opens a candidate template list, commas do not clear it, and the later `>` (including `>=`) closes it, so the list mis-parses. `<=` and `<<` never open one. Slang emits call and constructor args at `EmitOp::General`, where `maybeEmitParens` does not parenthesize relational operators (#13566).
- **To exercise WGSL `select(...)` argument lists, use vector `&&`/`||`** (`(u <= v) && (u >= v)` on `float2`). A `{a, b}` struct initializer lowers to a synthesized-ctor call, not `kIROp_MakeStruct`, so it only re-tests the call-argument path.
- **For a "wrap this op in parens" emit fix, reuse the shared printer**: `emit("("); defaultEmitInstExpr(inst, getInfo(EmitOp::General)); emit(")");` (Metal's MakeArray uses the same pattern).
- **WGSL has no unary `-` on matrices and no single-scalar matrix constructor.** `matCxR<T>(0) - m` is invalid (`vecN<T>(0)` is a valid splat). Emit `T(-1) * m` (keeps IEEE -0) or `matCxR<T>() - m`. Scalar `uint` `- x` is also naga-rejected (#13571).
- **int64/uint64 matrices survive `legalizeMatrixTypes` on WGSL** (only 32-bit `IRIntType`/`IRUIntType`/`IRBoolType` are lowered) and emit `mat2x2<i64>`, which naga rejects. A WGSL emitter `SLANG_ASSERT(isFloatingType(matrixElt))` is reachable from user code, and in Release it is `[[assume]]` UB.
- **Probe more than one source spelling before calling a shape unreachable** — `int64_t2x2(...)` gave E38203 where `matrix<int64_t,2,2>(...)` compiled.
- **The #13572 fix lowers every non-float matrix on WGPU** (`return !isFloatingType(elementType)`), and the existing 32-bit vector-width validation then reports E38203. A regression test built from int64 *scalars* is vacuous, because AST lowering already makes an int64 vector and E38203 fires on the old build too. Build the matrix from a float-matrix cast, and write location-less annotations (the lowered vector has no source location).

## GPU-free WGSL validation with naga-wasm

You can check whether Slang's WGSL output parses and validates in wgpu/Naga without a GPU or a Rust toolchain. `npm install naga-wasm@30.2.0` installs the naga translator compiled to WASM (it warns about node >=24.12 but works on node 22):

```js
import { parseWgsl, validate } from "naga-wasm";
const m = parseWgsl(src); validate(m);  // throws on parse/validation error
```

This is the cheapest oracle for the emitter bugs below: each error message quoted on this page came from it ([GPU-free WGSL parse/validate check: naga-wasm](../learnings/1791663423398-gpu-free-wgsl-parse-validate-check-naga-wasm-via-n.md)). For WGSL generated on the Tint path, the wgpu-py route on the bindless/Tint page is the alternative.

## Template-list ambiguity in comma-separated argument lists (#13566)

Consider `vec2<bool>(a_0 < b_0, a_0 > b_0)`. naga reports "expected `)`, found b_0". WGSL §3.9 disambiguates template lists syntactically: `ident <` opens a candidate list, commas do not clear it, and a later `>` (including `>=`) closes it, while `<=` and `<<` never open one. Slang emits call and constructor arguments at `EmitOp::General`, and `maybeEmitParens` does not parenthesize relational operators at that precedence, so the bare comparison reaches the output. User-side workarounds mostly fail: source parens `(a < b)` are dropped and locals get folded back into the call; only rewriting so that no `<` is followed by `>` in the same list (`b < a`) works [same](../learnings/1791663423398-gpu-free-wgsl-parse-validate-check-naga-wasm-via-n.md).

Testing the fix (PR #13569) needs inputs that actually reach each comma-separated emit path. `Flags f = { a < b, a > b };` does not reach the WGSL `kIROp_MakeStruct` case: it lowers to a call of the synthesized constructor `Flags_x24init_0(...)` and only re-tests the call-argument path (see [[wiki/concepts/slang-language-core-struct-construction-lowering.md]]). To exercise the `select(...)` argument lists, use vector `&&`/`||`, such as `(u <= v) && (u >= v)` on `float2`, which the WGSL emitter lowers to `select(vec2<bool>(false), rhs, lhs)`. For the emit side, `m_writer->emit("("); defaultEmitInstExpr(inst, getInfo(EmitOp::General)); m_writer->emit(")");` reuses the shared printer instead of copying it, the same wrap-the-default pattern Metal uses for MakeArray [a `{a, b}` initializer list on WGSL lowers to a synthesized ctor call](../learnings/1791675327416-slang-a-b-initializer-list-on-wgsl-lowers-to-a-syn.md).

## Matrix negation: `T(0) - m` is not WGSL (#13571)

WGSL has no single-scalar matrix constructor and no unary `-` on matrices. `WGSLSourceEmitter::tryEmitInstExprImpl`'s `kIROp_Neg` case (slang-emit-wgsl.cpp ~:1756) lowered both vectors and matrices to `(T(0) - x)`. `vecN<T>(0)` is a valid splat, but `matCxR<T>(0)` is not; naga reports "cannot cast a {AbstractInt} to a mat2x2<f32>". The form was added in #7936 by mirroring Metal, where `matrix<…>(0)` IS valid MSL; #12909 fixed only the operand parens, and its test pins the invalid form. Legal replacements are `(f32(-1) * m)`, which keeps IEEE -0 like `-x`, or the zero-value constructor `mat2x2<f32>() - m`. Releases up to 2025.12 emitted `- mat2x2(...)`, also invalid, so this was never valid and is not a regression.

Int, uint and bool matrices are unaffected, because `legalizeMatrixTypes` turns them into arrays of row vectors. Matrix-plus-scalar is fine as well: `legalizeBinaryOp` splats the scalar into `MakeMatrixFromScalar`, which the base emitter expands element by element. A sibling defect is scalar `uint` negation, which emits `- x` and is also naga-rejected ("Operation Negate can't work") [WGSL matrix negation `T(0) - m` is invalid; use `T(-1) * m`](../learnings/1791749878369-wgsl-emitter-matrix-negation-t-0-m-is-invalid-use-.md).

## 64-bit integer matrices reach the emitter as `IRMatrixType`

"`legalizeMatrixTypes` lowers integer matrices" is only true for 32-bit elements. `shouldLowerMatrixType` (slang-ir-legalize-matrix-types.cpp:76-78) lowers only `IRBoolType`, `IRIntType` and `IRUIntType` for WGSL, so `matrix<int64_t,2,2>` and `matrix<uint64_t,2,2>` compile with rc 0 to `-target wgsl` and emit `mat2x2<i64>(...)`, which naga rejects with "matrix scalar type must be floating-point", even for a plain `m + m`. Other element types fail earlier: int16/uint16 give E56103, and int8 and double give ICEs.

For review this means any WGSL emitter code that does `SLANG_ASSERT(isFloatingType(matrixElt))` on the grounds that integer matrices are lowered is reachable from user code, and in Release `SLANG_ASSERT` is `SLANG_ASSUME` (`[[assume]]`), so the violation is UB rather than a clean failure (found on #13572). When probing such a claim, try more than one source spelling: `int64_t2x2(buf[0],...)` with a `RWStructuredBuffer<int64_t>` gave E38203 in one probe, while `matrix<int64_t,2,2>(b[0],b[1],b[2],b[3])` with an `o[0] = float2x2(-m)[0][0]` consumer compiled cleanly [int64/uint64 matrices survive legalizeMatrixTypes on WGSL](../learnings/1791763584478-wgsl-int64-uint64-matrices-survive-legalizematrixt.md).

**The fix and its test (#13572).** On WGPU targets `shouldLowerMatrixType` now lowers every non-float matrix (`return !isFloatingType(elementType)`), so the WGPU vector-width validation in `slang-ir-validate.cpp` (allowedWidths = 32) reports E38203 instead of the emitter ICEing on `-m` or printing `mat3x3<i64>`. The first regression test built the matrix from int64 scalars, `matrix<int64_t,2,2>(b[0],b[1],b[2],b[3])`; AST lowering already creates an int64 *vector* there, so E38203 fired on the unfixed build too and the test proved nothing. Converting a float matrix (`matrix<int64_t,2,2>(floatMat)`) means no 64-bit vector exists until matrix lowering, and the old build fails the row. The diagnostic then has no source location, so the DIAGNOSTIC_TEST annotations must be location-less, without carets. This is the same spelling sensitivity as the probe above, and the general rule is to run every new diagnostic or negative row against the unfixed build before trusting it [a diagnostic test for WGSL matrix lowering can be vacuous](../learnings/1791809366702-slang-wgsl-a-diagnostic-test-for-matrix-lowering-c.md).

**Source learnings (5):**
- [GPU-free WGSL parse/validate check: naga-wasm via npm (node)](../learnings/1791663423398-gpu-free-wgsl-parse-validate-check-naga-wasm-via-n.md) — `validate(parseWgsl(src))`; caught the §3.9 template-list mis-parse of `vec2<bool>(a < b, a > b)` (#13566)
- [Slang `{a, b}` initializer list on WGSL lowers to a synthesized ctor call, not kIROp_MakeStruct](../learnings/1791675327416-slang-a-b-initializer-list-on-wgsl-lowers-to-a-syn.md) — use vector `&&`/`||` to reach `select(...)` lists; wrap `defaultEmitInstExpr` in parens rather than copying it
- [WGSL emitter: matrix negation `T(0) - m` is invalid; use `T(-1) * m`](../learnings/1791749878369-wgsl-emitter-matrix-negation-t-0-m-is-invalid-use-.md) — no matrix unary minus or scalar matrix ctor in WGSL; never valid, not a regression (#13571)
- [WGSL: int64/uint64 matrices survive legalizeMatrixTypes and reach the emitter as IRMatrixType](../learnings/1791763584478-wgsl-int64-uint64-matrices-survive-legalizematrixt.md) — `mat2x2<i64>` emitted with rc 0; float-only emitter asserts are reachable (Release UB) (#13572)
- [Slang WGSL: a diagnostic test for matrix lowering can be vacuous — build the int64 matrix from a float-matrix cast](../learnings/1791809366702-slang-wgsl-a-diagnostic-test-for-matrix-lowering-c.md) — #13572 lowers all non-float matrices on WGPU → E38203; scalar-built test fires on the old build; location-less annotations

_Catalog: [[wiki/index.md]]_
