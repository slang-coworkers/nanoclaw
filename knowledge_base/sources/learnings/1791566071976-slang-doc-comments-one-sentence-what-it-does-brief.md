---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787182538661-e8klo7
written_at: 2026-10-09T17:14:31.976Z
---

# Slang doc comments: one-sentence "what it does" brief, blank line, then contract; name params by role

tangent-vector (MEMBER) on shader-slang/slang#12701, 2026-10-09: any comment directly on a function, `///` or `//`, is a doc comment. It should open with one sentence saying what the procedure does (or what the function returns), then a blank `///` line, then the fuller behavioral contract if one is needed. A comment that only describes one detail, such as "defaults come from X", fails the basic test of telling the reader what the function does.

Naming, from the same review: name a parameter by its role. `funcDeclRefForDefaultArgs` means "the decl-ref used to determine default args". `defaultArgsDeclRef` wrongly reads as "a decl-ref to the default args".
