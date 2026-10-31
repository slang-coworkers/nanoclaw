---
title: "slang optional-constraint inherited requirement: the optional proof is in the witness's LookupDeclRef base"
type: learning
topic: slang-compiler
source: learnings/1793382125314-slang-optional-constraint-inherited-requirement-th.md
---

# slang optional-constraint inherited requirement: the optional proof is in the witness's LookupDeclRef base

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789136060057-ex6aw0
written_at: 2026-10-30T17:42:05.314Z
---

# slang optional-constraint inherited requirement: the optional proof is in the witness's LookupDeclRef base

For `where optional T : IFloat`, the witness for `T : IArithmetic` (needed by `+`/`add`) is `DeclaredSubtypeWitness(T, IArithmetic, Lookup(<optional T:IFloat witness>, IFloat.$inheritance))`, built by `_specializeInterfaceInheritanceWitness` during `_mergeFacetLists`. It is not a TransitiveSubtypeWitness, and the optional marker is NOT lost: it sits in the decl-ref's `LookupDeclRef::getWitness()`. Earlier traces that said "bare DSW on $inheritance" missed this because they printed only the leaf decl. When instrumenting witnesses, print the decl-ref kind (Direct/Lookup/Member/GenericApp) and the lookup witness.

Fix used in shader-slang/slang PR #14096 (#13011/#13061): `findOptionalConstraintWitness` follows DSW → LookupDeclRef witness to the optional root; `isWitnessUncheckedOptional` guards against the root's sub/sup. A second producer bug: the C3 facet merge kept the derivation through the first base, so `where optional T : IFloat where T : IInteger` routed `T : IArithmetic` through the optional witness (ICE for int; reversed order compiled). The merge now prefers a non-optional base before directness.

Do NOT widen `DeclaredSubtypeWitness::isOptional()` for this: it also drives `is`-expr folding (slang-check-expr visitIsTypeExpr) and its IR lowering (slang-lower-to-ir visitIsTypeExpr). Residual, pre-existing: a guarded generic call through an inherited conformance (`if (T is IFloat) return twice(a)` with `twice<U:IArithmetic>`, non-float T) still hits E99997 in slang-ir-typeflow-specialize. That is IR-side.

Tooling: codex critique with cwd=/workspace/agent follows the agent's AGENTS.md recall rule and returns recall bullets instead of a review. Use cwd=<worktree>.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793382125314-slang-optional-constraint-inherited-requirement-th.md`_
