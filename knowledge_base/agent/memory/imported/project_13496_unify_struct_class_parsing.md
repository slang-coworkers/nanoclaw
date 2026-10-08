---
type: project
name: project_13496_unify_struct_class_parsing
description: "slang#13496 (tangent-vector, self-assigned, Dev Opened, 10-07 19:59Z): refactor proposal — one core parser for struct / HLSL class / Slang class (ParseStruct vs ParseClass drifted: generics, where, anonymous, bodyless, link-time wrappers, attrs); construct-specific limits move to semantic checking. Companion of #13495 / her PR #13497. TRIAGED 10-07 20:49Z (cmt 6046591267, enhancement/low/P3), NO fixer; parked on tangent-vector; re-chase task rechase-13496-maintainer-2a24 2026-10-21. UNFILED side finding (class B : A → E30832) awaits operator."
metadata:
  node_type: memory
  type: project
---
**2026-10-07 20:0xZ.** Live read before dispatch: OPEN, 0 comments, human-filed by tangent-vector
(MEMBER), self-assigned, label `Dev Opened`, body 2423 chars. Not bot-filed. No prior session on
`gh-issue-shader-slang/slang-13496` other than this Main webhook session.

Sibling #13495 ("Treat HLSL class declarations as value types instead of Slang reference types") is
the focused compatibility fix the body cites. It has its own Main session (`sess-1791403180696-0z9jbj`)
and is not this chain's to route.

Dispatched to `slang-triager` on thread `gh-issue-shader-slang/slang-13496`: read-only triage, map the
divergence between `Parser::ParseStruct` and `Parser::ParseClass`, note the overlap with #13495, and
post the 5-bullet. No fixer, following the #13306 precedent ([[project_13306_global_uniform_as_temporary_hlsl_gec]]).

RESUME: triager report, a tangent-vector reply/go-ahead (webhook), or #13495 landing a PR that changes
the parsing baseline.

20:06Z triager ack: read-only triage started at master 93a54974c (divergence map + probe matrix). Awaiting report.

**20:52Z triage report (verified live by Main 20:5xZ: cmt 6046591267, nv-slang-bot[bot], 3203 chars,
1 comment on issue; #13497 = tangent-vector non-draft "Parse HLSL classes as value types", 20:19Z).**
Verdict enhancement / frontend parser+checker / low / P3, at master 93a54974c. `ParseStruct`
slang-parser.cpp:6524-6593, `ParseClass` :6595-6609. Accidental class restrictions: inline `<T>`
(`__generic<T:I> class` already works, so parser-only), `where`, local class E30102 (lookahead :7357).
Possibly real: anonymous Slang class (no `new`). Design calls: `= Type` wrapper (aliasedType checked
only in visitStructDecl :3128), bodyless class. No test pins a class parse error. Comment takes #13497
as baseline. Triager memo: slang-triager `memory/issues/triage-13496.md`.

**Side finding, UNFILED, asked operator 10-07:** `class B : A` (class base) → E30832 "cannot be used for
inheritance": `checkConformanceToType` (slang-check-decl.cpp ~:11925) has interface + StructDecl
branches only. Main confirmed the branch shape in source at origin/master 649a6f83bd; no test covers
class-from-class inheritance and dedup search ("class inheritance") finds only #13496. Not in the
triage comment. Default if no answer: hold (don't file uninvited on a maintainer's self-filed design
issue).

**Parked** on tangent-vector. Re-chase task `rechase-13496-maintainer-2a24` fires 2026-10-21T17:00Z
(dashboard-only, no GitHub post, no fixer). Reopen on a human comment (webhook).
