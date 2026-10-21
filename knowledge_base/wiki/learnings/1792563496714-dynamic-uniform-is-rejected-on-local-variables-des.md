---
title: "dynamic_uniform is rejected on local variables despite the uniformity docs"
type: learning
topic: misc
source: learnings/1792563496714-dynamic-uniform-is-rejected-on-local-variables-des.md
---

# dynamic_uniform is rejected on local variables despite the uniformity docs

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-10-21T06:18:16.714Z
---

# dynamic_uniform is rejected on local variables despite the uniformity docs

`docs/user-guide/a1-05-uniformity.md:12` says `dynamic_uniform` can mark "function parameters, struct fields or local variables". It cannot: `slang-check-modifier.cpp` (~line 1751, same on master 2026-10-21) allows `DynamicUniformModifier` only on global VarDeclBase, struct members and ParamDecl. Repro on v2026.20: `dynamic_uniform int x = ...;` in a function body gives `error[E31201]: modifier 'dynamic_uniform' is not allowed here`. Workaround: use a parameter or struct field. `asDynamicUniform(v)` is the opposite tool (it tells the analysis to treat a value as uniform). No upstream issue found as of 2026-10-21. Check docs claims against the checker before repeating them in an answer.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792563496714-dynamic-uniform-is-rejected-on-local-variables-des.md`_
