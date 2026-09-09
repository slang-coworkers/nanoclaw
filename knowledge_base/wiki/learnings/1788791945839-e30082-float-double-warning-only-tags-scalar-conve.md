---
title: "E30082 float→double warning only tags scalar conversions; generic vector/matrix inits can't carry the tag"
type: learning
topic: slang-compiler
source: learnings/1788791945839-e30082-float-double-warning-only-tags-scalar-conve.md
---

# E30082 float→double warning only tags scalar conversions; generic vector/matrix inits can't carry the tag

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788791346324-bj9lc3
written_at: 2026-09-07T14:39:05.839Z
---

# E30082 float→double warning only tags scalar conversions; generic vector/matrix inits can't carry the tag

When extending the "implicit float-to-double conversion" diagnostic **E30082** (or reasoning about why it fires inconsistently), know the mechanism:

- Emission is in `SemanticsVisitor::_coerce` at `source/slang/slang-check-conversion.cpp:2883-2892`. It fires ONLY when: `site == CoercionSite::Argument`, the chosen conversion initializer's decl carries the modifier tag `kBuiltinConversion_FloatToDouble` (read via `getImplicitConversionBuiltinKind`, `:336-344`), and `fromExpr` is not a `FloatingPointLiteralExpr` (literals are exempt).
- That tag is stamped **only** on the per-pair SCALAR `double.__init(float)` generated in the base-type meta-loop at `core.meta.slang:1213-1224` (`__implicit_conversion($(cost), $(builtinConversionKind))`, 2nd arg present). The `BuiltinConversionKind` enum (`slang-ast-support-types.h:194-199`) has literally one meaningful value.
- **Vector and matrix** float→double conversions go through a SINGLE GENERIC init — `vector<T,N>`'s `__generic<U:__BuiltinFloatingPointType> __init(vector<U,N> other)` at `core.meta.slang:2412-2417` (matrix analog ~2911-2913, coop-vector ~2384-2390). These declare `__implicit_conversion($(cost))` with NO 2nd arg ⇒ kind defaults to `kBuiltinConversion_Unknown` (`slang-parser.cpp:10639`) ⇒ the `== kBuiltinConversion_FloatToDouble` check is false ⇒ **silent** (this is issue #12930).

Why you can't just tag the generic init: one generic `__init` covers all float-family element conversions (float→double AND double→float narrowing, half→float, …). A static tag would wrongly warn on narrowing. The principled fix is to detect float→double from the CONCRETE element `BaseType` at the emission site (peel `VectorExpressionType`/`MatrixExpressionType` to element `BasicExpressionType`; warn when from==`BaseType::Float` && to==`BaseType::Double`), which covers scalar/vector/matrix uniformly and lets you delete the scalar-only tag machinery.

General pattern: decl-level "builtin conversion kind" tags in core.meta.slang only work for the non-generic per-base-type-pair inits; any diagnostic that must also cover aggregate (vector/matrix) conversions has to key off concrete instantiated types at the coercion site, not the generic decl's tag. E30082 was UNCOVERED by tests (diagnostics-catalog).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788791945839-e30082-float-double-warning-only-tags-scalar-conve.md`_
