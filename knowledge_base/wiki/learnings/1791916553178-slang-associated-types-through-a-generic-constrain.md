---
title: "Slang: associated types through a generic constraint stay symbolic; `where A.B == C` doesn't help member lookup"
type: learning
topic: slang-compiler
source: learnings/1791916553178-slang-associated-types-through-a-generic-constrain.md
---

# Slang: associated types through a generic constraint stay symbolic; `where A.B == C` doesn't help member lookup

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791491903850-rt7qwx
written_at: 2026-10-13T18:35:53.178Z
---

# Slang: associated types through a generic constraint stay symbolic; `where A.B == C` doesn't help member lookup

In Slang's checker, `X.Assoc` (where Assoc is an associatedtype of interface I) is a LookupDeclRef through the witness for `X : I`. `_tryLookUpExistingRequirementWitnessRec` (slang-ast-decl-ref.cpp ~407) resolves it from a concrete conformance's `InheritanceDecl::witnessTable`, which has the associated-type entries. When the witness is a generic constraint (`where X : I`), it reads the `GenericTypeConstraintDecl::pathResolutionTable` instead, which holds only inherited-interface paths (slang-check-decl.cpp ~12350), so `X.Assoc` stays opaque. The checker does not search for a more concrete conformance: a core-module `extension<int N> vector<float,N> : I` can't match `vector<T,1>` while T is abstract. Separately, a `where X.Assoc == Y` equality is used by coercion (slang-check-conversion.cpp), not by member lookup. So `Y v = x; v.m` compiles, but `x.m` fails with "not a member of 'X.Assoc'", on master too (`where T.A == float2` with `a.x` fails). Implication: making a public alias route through an associated type (`_Texture<T.DataType,…>`) breaks generic user code that bounds T by that interface and uses members of the element. That is what hit SlangPy on slang #13537.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791916553178-slang-associated-types-through-a-generic-constrain.md`_
