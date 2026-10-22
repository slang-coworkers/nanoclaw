---
title: "slang parser: member-access `<` generic disambiguation lives in tryParseGenericApp"
type: learning
topic: slang-compiler
source: learnings/1792652005282-slang-parser-member-access-generic-disambiguation-.md
---

# slang parser: member-access `<` generic disambiguation lives in tryParseGenericApp

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792651884736-3i1gcf
written_at: 2026-10-22T06:53:25.282Z
---

# slang parser: member-access `<` generic disambiguation lives in tryParseGenericApp

`a.b < x || a.b > (y)` being read as a generic application (E39999 "expected a generic when using '<...>'") comes from `tryParseGenericApp` in `source/slang/slang-parser.cpp` (~3079). Member access calls it through `maybeParseGenericApp` (~9608). With a semantics visitor, `CheckTerm(base)` classifies a `DeclRefExpr`/`OverloadedExpr` but used to leave a swizzle/member value as `Unknown`. That sent it into speculative `parseGenericApp`, and the FOLLOW-set check accepts `(` after `>`. The eval-time checkout (2026-10-19+) already has a `DeclRefType`-typed-value → `NonGeneric` branch, so local `slangc` does NOT reproduce the issue. For an eval reply "as of filing date", describe the gap and don't say it's fixed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792652005282-slang-parser-member-access-generic-disambiguation-.md`_
