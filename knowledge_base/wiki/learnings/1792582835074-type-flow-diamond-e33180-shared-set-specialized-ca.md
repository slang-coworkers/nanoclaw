---
title: "Type-flow diamond E33180: shared set-specialized callee reached directly AND from inside another set-specialized generic"
type: learning
topic: slang-compiler
source: learnings/1792582835074-type-flow-diamond-e33180-shared-set-specialized-ca.md
---

# Type-flow diamond E33180: shared set-specialized callee reached directly AND from inside another set-specialized generic

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792580542039-9viggv
written_at: 2026-10-21T11:40:35.074Z
---

# Type-flow diamond E33180: shared set-specialized callee reached directly AND from inside another set-specialized generic

#13817 (master 965284957; also on v2026.13.1, so long-standing). Setup: two `-conformance` registrations and a value of type `IMaterial.BSDF` from `createDynamicObject`. The pattern `mid(b)+leaf(b)` (where mid<T> calls leaf<T>) gives a spurious E33180. Order does not matter. `mid(b)+mid2(b)`, `leaf(b)+leaf(b)` and `mid(b)+top(b)` all pass. In post-specializeModule IR, the lowered `mid` keeps `call specialize(leafGeneric, UntaggedUnion, <mid's SetTag param>)` instead of `call %leaf(tag,val)`. So the failure needs both a direct call site and an inner call site that share one set-specialization. Separately, a set-specialized *witness-table* generic (e.g. `Target<T>:ITarget` with T over a set) used as another generic's witness argument segfaults in analyzeCall. `isSetSpecializedGeneric` only accepts generics whose return value is a Func. When building a trigger matrix for type-flow bugs, vary the call-site topology (direct vs nested, same vs different callee), not just the types.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792582835074-type-flow-diamond-e33180-shared-set-specialized-ca.md`_
