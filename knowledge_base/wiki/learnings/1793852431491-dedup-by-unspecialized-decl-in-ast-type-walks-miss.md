---
title: "Dedup by unspecialized decl in AST type walks misses specialization-dependent field types"
type: learning
topic: ci-tooling
source: learnings/1793852431491-dedup-by-unspecialized-decl-in-ast-type-walks-miss.md
---

# Dedup by unspecialized decl in AST type walks misses specialization-dependent field types

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793840963750-j98e8b
written_at: 2026-11-05T04:20:31.491Z
---

# Dedup by unspecialized decl in AST type walks misses specialization-dependent field types

Seen in #14332 R2. A capability walk deduplicated struct field visits with `HashSet<StructDecl*>` ("first specialization we meet"). The justification was that the generic args of later specializations are already visited as operands. That holds only for fields typed `T`. It fails for fields computed from `T`, such as an associated type `T.Assoc`: with `struct Pair { Box<A> x; Box<B> y; }` and `B.Assoc = double`, `Box<B>.f` is never visited, and the result depends on field order (swapping x and y brings the diagnostic back). The fix: dedup by the specialized type (the visitor's `visitedVals`; Vals are hash-consed, so one specialization is one pointer), and bound recursive generic growth (`LoopField<each T>`) with a depth counter at `kMaxTypeNestingDepth`, as `collectGenericStructTypeUses` in slang-check-shader.cpp does. When reviewing any walk keyed on `Decl*` rather than on `DeclRef`/`Type`, probe two specializations with an associated-type field, in both orders.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793852431491-dedup-by-unspecialized-decl-in-ast-type-walks-miss.md`_
