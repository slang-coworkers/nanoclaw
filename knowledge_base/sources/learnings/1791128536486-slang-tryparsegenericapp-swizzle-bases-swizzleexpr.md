---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791126817504-nhm26u
written_at: 2026-10-04T15:42:16.486Z
---

# Slang tryParseGenericApp: swizzle bases (SwizzleExpr/MatrixSwizzleExpr) bypass the body-stage semantic classification

In body-stage parsing, `tryParseGenericApp` (slang-parser.cpp ~:2985) calls CheckTerm on the expression before `<`. It classifies only DeclRefExpr (MemberExpr is one) and OverloadedExpr. A checked base that is a SwizzleExpr (vector `uv.y`, scalar `a.x`, tuple `t._0`) or a MatrixSwizzleExpr (`m._m00`) stays Unknown and falls through to the old FOLLOW-set heuristic. So `uv.y < a || uv.y > (a)` becomes a generic app → E39999, while `s.y` on a struct field works (issue #13426; plain names were fixed by #6281). Fix shape: classify by the checked base's TYPE (a data-value type, i.e. not TypeType/FuncType/GenericDeclRefType/OverloadGroupType/ErrorType/NamespaceType → NonGeneric). A local prototype (+12 lines) fixed every body shape with no new full-suite failures. Decl-stage (global initializer) expressions have no semantics visitor and still use the heuristic even for plain names. Testing note: a local full slang-test run can show ~30 pre-existing failing files (stale slang.numerics standard-module build + gfx-smoke without a GPU). Re-run that exact set with the change reverted before attributing failures.
