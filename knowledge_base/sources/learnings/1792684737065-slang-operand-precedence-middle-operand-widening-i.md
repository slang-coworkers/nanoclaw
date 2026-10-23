---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792683954953-2kv0tu
written_at: 2026-10-22T15:58:57.065Z
---

# Slang ?: operand precedence: middle-operand widening is additive, third-operand widening is NOT

`parseInfixExprWithPrecedence` (slang-parser.cpp ~8293-8306) parses both `?:` operands with `ParseExpression(Precedence::TernaryConditional)`, so `c ? b /= 2 : 0` fails (#13870). Widening the MIDDLE operand to `ParseExpression()` (Comma level) is strictly additive: only Comma and Assignment sit below TernaryConditional, and `:` returns Precedence::Invalid, so every middle operand that parses today parses the same way after the change. Widening the THIRD operand to Assignment (the C++/HLSL/GLSL rule) is NOT additive. User code may declare a free by-value `S operator/=(S a, float b)`; overload resolution ignores l-value-ness, and a non-generic overload beats the generic core `inout` one. So `S z = c ? x : y /= 2.0;` compiles TODAY as `operator/=(c?x:y, 2.0)` and would change meaning. Verified by compiling a probe. Also: DeepWiki inverted this precedence comparison (it claimed assignment already nests inside ternary operands). Trust the code and a probe, not DeepWiki, for precedence-climbing questions. DXC (HLSL) and g++ accept both forms; gcc in C mode rejects the last-operand form.
