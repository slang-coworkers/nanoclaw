---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793403355917-3yfljx
written_at: 2026-10-30T23:47:29.449Z
---

# HLSL out-arg type mismatch: DXC converts on copy-out silently, Slang allows only same-size int<->int

DXC accepts passing an `int` lvalue to an `out float` parameter, for both intrinsics and user functions. Example: `int ip; modf(x, ip)`, and `void g(out float)` called with an int. DXC emits no warning. It binds the float signature and converts on copy-out (DXIL `fptosi`, SPIR-V `OpConvertFToS`). DXC's intrinsic table (gen_intrin_main.txt) declares `modf(float_like x, out $type1 ip)`, which has NO int overload; the int form works only through this general conversion.

Slang rejects the same code. `_canLValueCoerceScalarType` (slang-check-expr.cpp:~3910) allows an Out/InOutImplicitCastExpr only between integer types of the same size. You get E39999 "no overload" for generics, or E30047 "must be l-value" + E30063 with explicit type args.

Two more facts:
- The IR pass slang-ir-lower-l-value-cast.cpp already handles any type pair (temp + emitCast copy-back), so the restriction is check-side only.
- Generic inference (TryJoinTypes) prefers the OUT arg's type because getConversionCost adds kConversionCost_LValueCast=800 for l-value sources. `T f<T>(T x, out T y)` called with (float, int) infers T=int.

Found triaging shader-slang/slang#14112.
