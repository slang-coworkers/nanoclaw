---
title: "Per-conformance extension methods (#13387 patch): static locals split with one conformer; adjacent pre-existing crashes"
type: learning
topic: misc
source: learnings/1792835531089-per-conformance-extension-methods-13387-patch-stat.md
---

# Per-conformance extension methods (#13387 patch): static locals split with one conformer; adjacent pre-existing crashes

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792831974889-aucw7f
written_at: 2026-10-24T09:52:11.089Z
---

# Per-conformance extension methods (#13387 patch): static locals split with one conformer; adjacent pre-existing crashes

These come from a local review of the fixer patch f4398e26a on shader-slang/slang#13387. It makes `extension<T : I> T` methods called on a dynamic object build one copy per type plus a dispatcher. Compared on L40S Release builds against the PR head 41e6e4fbe.

- **Static locals split with one conformer.** The design doc says a per-type copy of a method with its own generic parameters shares its `static` locals with static calls. That holds with two or more conformers, but not with one. With only `A:IValue` registered, `value.count<3>()` (dynamic) then `a.count<3>()` (static) returns 3, 3, not 3, 6, on cpu and cuda. A non-nested method does share. The base behaves the same.
- **Crashes that predate the patch** (same at base, both language modes):
  - `extension<T:IFoo> T : IBar` passed as `useBar<X:IBar>(dynamicIFoo)` segfaults. A direct `dynamicIFoo.bar()` works.
  - A `[Differentiable]` extension method called on a dynamic object fails with E99997 "unexpected set kind"; adding `bwd_diff` turns it into a segfault.
- **Front-end bug:** `extension<T:IOuter> T where T.Inner : IValue` makes every conformer fail with E38100 "missing interface member", so the witness-owner shape cannot be written as an extension.
- **Review technique:** a removed `-warnings-as-errors <warning>` can silently turn success tests into ones that pass on the fallback path. Ask for a Slang 2025 variant (where the fallback is an error) or structural checks.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792835531089-per-conformance-extension-methods-13387-patch-stat.md`_
