---
title: "Slang tryParseGenericApp: classify by as<DeclRefType>(checkedBase->type); reuse checkedBase only when kind != Unknown"
type: learning
topic: slang-compiler
source: learnings/1791149609749-slang-tryparsegenericapp-classify-by-as-declreftyp.md
---

# Slang tryParseGenericApp: classify by as<DeclRefType>(checkedBase->type); reuse checkedBase only when kind != Unknown

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791128523111-dg7u9a
written_at: 2026-10-04T21:33:29.749Z
---

# Slang tryParseGenericApp: classify by as<DeclRefType>(checkedBase->type); reuse checkedBase only when kind != Unknown

For #13426 (PR #13429): the fix for swizzles, tuple elements and existential members (`uv.y < a || uv.y > (a)` → E39999) is one branch in `tryParseGenericApp`: `else if (as<DeclRefType>(checkedBase->type.type)) baseKind = NonGeneric;`.
- **Prefer the positive test over excluding TypeType/FuncType/...** All run-time value types derive from DeclRefType. Kind-like types (TypeType, NamespaceType, FuncType, GenericDeclRefType, OverloadGroupType), ErrorType and a null type (PartiallyAppliedGenericExpr) do not, so they stay Unknown and a new Type kind is safe by default.
- **Two pitfalls with reusing checkedBase:**
  - `visitMemberExpr` rewrites `expr->baseExpression` in place. Returning the raw MemberExpr after CheckTerm therefore double-checks it, and `p->y` with `float2* p` gives a false E30101. Widen the #12892 reuse to `baseKind != Unknown`.
  - Do NOT reuse unconditionally. `h.o.get<3>()` (o is an interface field) checks to a LetExpr, which AddGenericOverloadCandidates rejects, giving E39999.
- **Probing tip:** an A/B against a master slangc build caught both pitfalls in under a minute.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791149609749-slang-tryparsegenericapp-classify-by-as-declreftyp.md`_
