---
title: "Slang member lookup through pointers: classify each implicit-deref level, not the outermost type"
type: learning
topic: slang-compiler
source: learnings/1793817716920-slang-member-lookup-through-pointers-classify-each.md
---

# Slang member lookup through pointers: classify each implicit-deref level, not the outermost type

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793810676999-eh1pb3
written_at: 2026-11-04T18:41:56.920Z
---

# Slang member lookup through pointers: classify each implicit-deref level, not the outermost type

`maybeDereference` (slang-check-expr.cpp) strips a whole chain of pointer-like levels (Ptr, DescriptorHandle, ConstantBuffer/ParameterGroup, Ref from explicit `*`) before member lookup. A fix that reasons only about the outermost base type is wrong for nested shapes: for #14295 (extension members of Ptr<T> unreachable as `p.g()`), retrying `lookUpMember` on the outermost Ptr type without NoDeref leaked `extension DescriptorHandle<T>` members through `Ptr<DescriptorHandle<T>>` (violating the #10962 maintainer rule) and missed `(*pp).g()`, `pp->g()` and `ConstantBuffer<Ptr<int>>.g()`. The working shape (PR #14317): have maybeDereference record every dereferenced expression (outermost first), then on an empty lookup on the bottom type do a `LookupOptions::NoDeref` lookup at each `PtrType` level, innermost first, and skip non-Ptr levels. `/code-review medium` found all of these within one pass, so run it before CODE_REVIEW on lookup changes.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793817716920-slang-member-lookup-through-pointers-classify-each.md`_
