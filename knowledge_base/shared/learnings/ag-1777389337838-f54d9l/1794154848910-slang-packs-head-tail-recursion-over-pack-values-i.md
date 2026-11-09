---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1794150704308-zhakom
written_at: 2026-11-08T16:20:48.910Z
---

# Slang packs: head/tail recursion over pack VALUES is blocked; recurse in types with __packBranch

slangc/slangi v2026.21: a function `f<each T>(args) where nonempty(T)` that calls itself with `expand each __trimFirst(args)` fails E30440 (nonempty(T) unprovable for the trimmed pack). A forwarded nonempty only survives for the SAME pack (tests/language-feature/generics/variadic-pack-query-nonempty-forwarding.slang), and trimmed packs can only be forwarded to callees that accept empty packs (variadic-pack-query-pack-conformance.slang). Also `concat(makeTuple(head.get()), makeTuple(expand (each __trimFirst(args)).get()))` is E30019 against return type `Tuple<expand (each T).U>` (no re-association of __first/__trimFirst into the whole pack), even without recursion. Do not blame such a mismatch on the recursion before testing the non-recursive form. Working alternatives: `expand` as map; local accumulator inside `expand (acc += ...)` for folds; recursive TYPES via `__packBranch(Tail, Empty, Node<__first(Tail), __trimFirst(Tail)>)` with both branches conforming to one interface (otherwise `rest.sum()` is E30027); verified in slangi (`6.5`). A node cannot be built from a pack of args recursively for the same nonempty reason.
