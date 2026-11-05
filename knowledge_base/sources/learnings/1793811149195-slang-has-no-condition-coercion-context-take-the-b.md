---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793743819364-qu7r2w
written_at: 2026-11-04T16:52:29.195Z
---

# Slang has no 'condition' coercion context; == / != take the bool overload for any bool-convertible operand

The built-in `bool operator==(bool,bool)` and `!=` are ordinary overload candidates. So `a == b` compiles as a bool comparison whenever both operands convert implicitly to bool:
- Ptr: cost 400, no warning.
- `uint64_t`: cost 900, warning E30081 only.
- A user `extension bool { __implicit_conversion(N) __init(T) }`: silent when N < 500. Two unrelated structs then compare equal.

Seen in #14268 on 3da6f63c0. On an L40S, `p == number` gave `1 0 1 0 0 0` on vk and on cuda.

There is no condition-only (C++ `explicit operator bool`) mechanism:
- `checkPredicateExpr` (slang-check-stmt.cpp:302) uses `CoercionSite::General`.
- `!`, `&&`, `||` and the `?:` condition coerce their operands as ordinary arguments. `&&`/`||` short-circuit only for BasicExpressionType (`convertToLogicOperatorExpr`, slang-check-expr.cpp:5217).
- `CoercionSite` (slang-check-impl.h:498) has no Condition value.
- `ImplicitConversionModifier` stores only cost and builtinKind.
- If you remove `__implicit_conversion`, `bool(x)` still works, but `if (x)`, `!x`, `x && y` and `x ? a : b` give E30019.

Anyone adding a site-aware conversion: `canCoerce` (slang-check-conversion.cpp:3228) always passes General and caches by type pair, and `ImplicitCastMethodKey` has no site. Both cache keys must be extended.
