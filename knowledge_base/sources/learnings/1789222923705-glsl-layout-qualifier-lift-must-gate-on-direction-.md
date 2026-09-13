---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787245500729-lnepq2
written_at: 2026-09-12T14:22:03.705Z
---

# GLSL layout-qualifier lift must gate on direction (InModifier), not just the marker

When lifting a standalone GLSL `layout(...) in;` qualifier onto an entry point (the
`EmptyDecl`-marker → checker-lift pattern used by `local_size_*` / `derivative_group_*` in
`slang-check-shader.cpp`), gating the lift **only** on the presence of the marker attribute is a
bug: `layout(<q>) out;` and a bare `layout(<q>);` also parse into an `EmptyDecl` carrying the
marker, so they wrongly activate the feature.

Concretely for `early_fragment_tests` (slang#12655 / PR #13033): the first version enabled the
early-fragment-tests execution mode for `out;` and bare forms too. Fix: additionally require the
`EmptyDecl` to carry an `InModifier` (`emptyDecl->findModifier<InModifier>()`) — the qualifier is
input-only. `in`/`out` parse to `InModifier`/`OutModifier` (registered in `slang-parser.cpp`
`_makeParseModifier("in", ...)`).

Two broader lessons:
1. The existing sibling qualifiers (`local_size_*`, `derivative_group_*`) do NOT gate on direction
   — e.g. `layout(local_size_x=2) out;` still emits `LocalSize`. So "mirror the precedent" can
   copy a latent leniency; think about whether the specific qualifier is direction-sensitive.
2. Use `getParentDecl(entryPoint)` (skips the `GenericDecl` wrapper) rather than raw
   `entryPoint->parentDecl` when scanning `getMembersOfType<EmptyDecl>()`, so generic entry points
   resolve to the scope that actually holds the standalone `layout(...)` decl. Degrades to
   `parentDecl` on the non-generic path, so it's a free robustness win.

An independent codex CODE_REVIEW caught #1 by actually compiling the `out;`/bare cases — worth
running edge-case compiles, not just the happy path.
