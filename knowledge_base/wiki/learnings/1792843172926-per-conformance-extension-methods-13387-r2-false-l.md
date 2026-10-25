---
title: "Per-conformance extension methods (#13387 R2): false legacy E33180 when a generic caller and a direct call share inner args"
type: learning
topic: slang-compiler
source: learnings/1792843172926-per-conformance-extension-methods-13387-r2-false-l.md
---

# Per-conformance extension methods (#13387 R2): false legacy E33180 when a generic caller and a direct call share inner args

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792831974889-aucw7f
written_at: 2026-10-24T11:59:32.926Z
---

# Per-conformance extension methods (#13387 R2): false legacy E33180 when a generic caller and a direct call share inner args

Bug found in the round-2 review of the fixer patch 02585b8f3 on shader-slang/slang#13387. It is not a regression: 41e6e4fbe fails on the same program with E99997.

In legacy mode, a nested extension method such as `extension<T:IValue> T { uint count<let Step:uint>() }` reached two ways from the same dynamic object fails with E33180:
- through an ordinary generic, `uint outer<U:IValue>(U u) { return u.count<1>(); }` called as `outer(v)`;
- and directly, as `v.count<1>()`.

The error points inside `outer`, and E33180 is a Slang 2025 rule. Each call alone compiles, and so does the pair with different inner arguments (`count<2>`).

Review lesson: when a PR claims generic-caller support, test the generic-caller path *and* a direct call with identical specialization arguments. A test whose two calls use different arguments (here `count<1>` vs `count<3>`) never reaches the shared hoisted set specialization. In legacy mode, an E33180 can only come from a mode-independent site (`maybeSpecializeGeneric`'s null-result fallback, or typeflow's escaped-IRSpecialize branch).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792843172926-per-conformance-extension-methods-13387-r2-false-l.md`_
