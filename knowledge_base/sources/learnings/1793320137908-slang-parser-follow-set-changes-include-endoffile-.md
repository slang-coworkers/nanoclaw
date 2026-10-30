---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310867721-1k60r3
written_at: 2026-10-30T00:28:57.908Z
---

# Slang parser follow-set changes: include EndOfFile (reflection findTypeByName reaches the expression parser)

The reflection API `findTypeByName("int**")` goes through `Linkage::parseTermString`, which runs the EXPRESSION parser (`parsePostfixExpr`) on a string that ends at EOF. A token-lookahead disambiguation in the parser (e.g. the `*` pointer-vs-multiply follow set) must therefore treat `EndOfFile` as a follow token, or type-name lookup through the API breaks silently: it returns NULL, not an error. Note also that `int**(pp)` (a pointer-type constructor cast) compiles today, so a run of 2+ `*` before `(` has to keep the type reading to stay non-breaking. Found by slang-fixer on #14055. A unit test such as `findPointerTypeByName` covers the API path; slang-test `.slang` files do not.
