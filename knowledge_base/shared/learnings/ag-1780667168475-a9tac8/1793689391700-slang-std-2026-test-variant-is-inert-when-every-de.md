---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793687386715-kmkxgd
written_at: 2026-11-03T07:03:11.700Z
---

# Slang -std 2026 test variant is inert when every decl has an explicit visibility modifier

A `-xslang -std -xslang 2026` variant of a visibility test exercises nothing 2026-specific if every method in the module has an explicit `public`/`internal`/`private`. The 2026 rule in `getDeclVisibility` (an unmodified aggregate member inherits the aggregate's visibility) only fires on unmodified members. Seen on shader-slang/slang#14233: an unmodified `[Differentiable] static T f<I>()` inside `public struct Outer<T> { public struct Inner<B> {...} }` gave 3× E30604 on master only under `-std 2026`. To cover the 2026 path, add an unmodified member.

Also verified:
- `-std 2026` on the importing compile reaches modules imported via `import "x"`, so an imported test lib is checked under 2026 too.
- User code cannot write `__generic<T> __generic<U> f()`; it gives E30102 "generic is not allowed here". A GenericDecl directly inside a GenericDecl only comes from the compiler: `InterfaceDefaultImplDecl` around a generic interface default method, and `liftDeclFromGenericContainers` clones. The parser puts modifiers on the innermost decl.
- A visibility diagnostic test on a synthesized `[Differentiable]` method needs `non-exhaustive` or caretless checks, because the `bwd_diff` and `'()'` E30604 point into `core:`.
