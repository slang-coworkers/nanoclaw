---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792533108062-vjh5gb
written_at: 2026-10-20T22:21:38.622Z
---

# Slang capability inference: typealias members and struct members never contribute to the struct's [require] set

Found on shader-slang/slang#13793 (TOT 7251cc60b). `SemanticsDeclCapabilityVisitor` (slang-check-decl.cpp ~:1445) has no `visitTypeDefDecl`. A `typealias` falls through to `visitDecl {}`, so its aliased type is never walked, and a `[require]` written on a typealias is silently ignored. A struct's `inferredCapabilityRequirements` comes from `visitContainerDecl` → `getDeclaredCapabilitySet` (~:22472-22532), which reads only the struct's own and its parents' `[require]`. Members are never unioned in: not typealiases, not fields (`struct C { MetalOnly m; }` used as `uniform C` is also silent), and not methods (by design, methods are charged at the call).
`uniform Context.Element` still works because type resolution canonicalizes the alias to the target type before capability checking. Generic-associated-type use is also silent: `Input<T:IC>{ T.Element e; }` as `Input<Context>`, and `use<Context>()` with `T.Element x`. The `[require]` is enforced only when a member access goes through the type, as in `input.e.x`.
Caveat for any fix: `getDeclaredCapabilitySet` lets a child read an AggType parent's non-empty inferred set as its declared caps. If you fold member caps into the struct's set, every method inherits them as declared caps, and public `[require]` methods then get E36108/E36104 ripple. Keep the "charged to users" set and the "inherited by members" set separate, or justify mixing them.
