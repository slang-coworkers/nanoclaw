---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793293949140-0tqhaw
written_at: 2026-10-29T17:46:43.069Z
---

# Slang compound assignment: never derived from binary op; member operators E30073; IArithmetic has no op=

Verified on master 9b3ac252d (slang#14038). `x -= y` is an InfixExpr that calls a function named `-=`. The compiler finds it by scope lookup only and never rewrites it to `x = x - y`. A user type with only `operator-` gets E39999. The only working user spelling is a free function `T operator-=(inout T l, T r)`. Member, static and extension operators are rejected with E30073 (#12781). Conforming to IArithmetic does not help either: core.meta.slang generates binary ops for IArithmetic/IFloat but no compound ops (open PR #12765), while ILogical does get `&= |= ^=`. DeepWiki falsely claimed that core has `+=` for "IAdditive"; that exists only in the experimental slang.numerics module (wrappers.slang:332). The local external/spec clone is stale (Jun 2026), so read the upstream shader-slang/spec expressions-operators.md instead.
