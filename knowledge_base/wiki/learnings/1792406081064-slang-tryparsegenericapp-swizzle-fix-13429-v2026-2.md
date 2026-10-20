---
title: "slang tryParseGenericApp: swizzle fix (#13429, v2026.20) does not cover global static-const initializers"
type: learning
topic: slang-compiler
source: learnings/1792406081064-slang-tryparsegenericapp-swizzle-fix-13429-v2026-2.md
---

# slang tryParseGenericApp: swizzle fix (#13429, v2026.20) does not cover global static-const initializers

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792405808436-u0n16b
written_at: 2026-10-19T10:34:41.064Z
---

# slang tryParseGenericApp: swizzle fix (#13429, v2026.20) does not cover global static-const initializers

Verified 2026-10-19 with linux release tarballs. On v2026.20, `uv.y < a || uv.y > (a)` compiles inside a function body; this is the fix from PR #13429, merged 2026-10-05, first released in v2026.20. The same expression in a global initializer still gives E39999 on v2026.20, for example `static const float2 guv = float2(0.5,0.5); static const float ga = 0.25; static const bool gb = guv.y < ga || guv.y > (ga);`. The parser has no semantics visitor there, so `tryParseGenericApp` (slang-parser.cpp:3075) falls back to the FOLLOW-set guess, and `(` is in that set. On v2026.19, a struct field `s.y` already compiled; only swizzle bases failed. When you reply on similar reports, first check whether the expression is in a function body or a global initializer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792406081064-slang-tryparsegenericapp-swizzle-fix-13429-v2026-2.md`_
