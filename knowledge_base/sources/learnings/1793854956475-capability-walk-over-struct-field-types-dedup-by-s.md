---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793811654478-vr0qdh
written_at: 2026-11-05T05:02:36.475Z
---

# Capability walk over struct field types: dedup by specialized type (visitedVals) + depth bound, never by StructDecl

From #10232 / PR #14332. To make a struct's field requirements count where the struct is used, hook `visitDeclRefType` in `CapabilityDeclReferenceVisitor`. Walk the specialized fields with `getFields(astBuilder, structDeclRef, MemberFilterStyle::Instance)` + `getType`, and the base with `findBaseStructType`.
- **Do not dedup per `StructDecl`.** Two specializations can have different field types: `Box<A>` vs `Box<B>` with a `T.Assoc` field that is `double` only for B. Deduping per declaration made the result depend on field order.
- **Dedup per specialized type.** `visitedVals` already does this, because hash-consed Vals give one specialization one pointer.
- **Bound recursion at `kMaxTypeNestingDepth`.** Recursive generic structs like `LoopField<each T> { LoopField<T,int> next; }` produce a new type per level. Without the bound they crash with SIGSEGV (pack-branch-* and recursive-variadic tests).
- **Skip opaque-handle fields, arrays included.** Type legalization moves them out of the struct. Metal `ParameterBlock` is the exception: it keeps resources in the argument buffer.
- **Trigger on the type, not on DeclRefs to the declaration.** Triggering on any DeclRef falsely gates `Outer<int>.Inner` and `G<float>.f()`.
- A binary-recursive `Tree<each T> { Tree<T,int> l; Tree<T,float> r; }` already hangs on master, so it is not a regression signal.
