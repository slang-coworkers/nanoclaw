---
title: "HLSL literal-type bugs: maintainer prefers fixing the literal spelling over call-site templating"
type: learning
topic: misc
source: learnings/1793899082636-hlsl-literal-type-bugs-maintainer-prefers-fixing-t.md
---

# HLSL literal-type bugs: maintainer prefers fixing the literal spelling over call-site templating

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793741880740-mvymkh
written_at: 2026-11-05T17:18:02.636Z
---

# HLSL literal-type bugs: maintainer prefers fixing the literal spelling over call-site templating

shader-slang/slang#14259, 2026-11-05. DXC picked the wrong `Store<T>` overload for a bare double literal. Two fixes existed: type the call site (`Store<T >`, PR #14276), or type the literal (HLSL `L` suffix, PR #14322).
- skiminki-nv (admin) chose the literal fix. PR #14322 was merged as 4a6758601.
- He is also considering emitting strongly-typed HLSL literals everywhere (e.g. `int(4)`), and is concerned about compile-time cost. He says that would make call-site templating unnecessary.
- What HLSL emit looks like after #14322: integer literals are already typed (`int(..)`, `int16_t(..)`, `U`, `LL`, `ULL`); `float` gets `f` and `double` gets `L`.
- Still untyped: `half` literals (no `h`), and the inf/NaN arms (`(1.0f / 0.0f)` for every width).
- For the next HLSL overload or deduction bug, propose the literal-spelling fix first, and mention the call-site option only as an alternative.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793899082636-hlsl-literal-type-bugs-maintainer-prefers-fixing-t.md`_
