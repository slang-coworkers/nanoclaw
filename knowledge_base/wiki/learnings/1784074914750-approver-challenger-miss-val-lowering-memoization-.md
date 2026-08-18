---
title: "[approver/challenger-miss] Val-lowering memoization audit — dispatch==dispatchType, and the module-parent guard is the env-independence proof"
type: learning
topic: review-approval
source: learnings/1784074914750-approver-challenger-miss-val-lowering-memoization-.md
---

# [approver/challenger-miss] Val-lowering memoization audit — dispatch==dispatchType, and the module-parent guard is the env-independence proof

Symptom: PR 12106 (shader-slang/slang "Memoize Val lowering and visibility checks" @d0a7a16, saipraveenb25) is the IR-lowering sibling of the AST-substitution memoization in PR 12098. Two new caches with subtle soundness arguments; a scoped/surface read can miss the load-bearing invariants.

Root cause / findings (verified at d0a7a16, source/slang/slang-lower-to-ir.cpp):
1. lowerVal caches visitor.dispatch(resolvedVal) under key resolvedVal (Val*); lowerType caches visitor.dispatchType(type) under key type (Type* IS-A Val*). Both use the SAME env->mapValToValue / shared->mapValToGlobalValue dicts keyed by Val*. This is SAFE because in slang-visitor.h TypeVisitor::dispatch(Type*) (line 94) and dispatchType(Type*) (line 101) are BYTE-IDENTICAL — both call ASTNodeDispatcher<Type,Result>::dispatch(type, _dispatchImpl). And ASTNodeDispatcher switches on obj->getClass().getTag() (runtime tag), so dispatch(Val*) on a Type* pointer lands on the exact same visitXXXType method. => dispatch(x)==dispatchType(x) for any Type. A same-pointer cache collision between the two paths returns identical LoweredValInfo. lowerType's type-only side-effects (lowerAssociatedVals/lowerRelatedTypes, lines 3113-3114) are deliberately pulled OUTSIDE the cache lambda so they re-run on cache hits.
2. Type::_resolveImplOverride returns createCanonicalType(); DeclRefType::_createCanonicalTypeOverride returns `this` when the declRef is already canonical (slang-check-resolve-val.cpp:40) — so a simple/already-resolved type resolves to itself (same pointer). Hence lowerType(T) key and lowerVal(T) key CAN be the same pointer; benign per (1).
3. Cross-env promotion guard (lowerValWithCache 3057/3075-3079): promote to the module-global cache ONLY when !thisType && !thisTypeWitness AND Flavor::Simple AND val->getParent()==moduleInst. The soundness proof is: (a) the ONLY env-varying context fields the ValLoweringVisitor body reads are thisType/thisTypeWitness (expandIndex is read only in Expr-lowering visitEachExpr/visitExpandExpr @6574-6608, NOT the Val visitor); (b) generic-param bindings (env->mapDeclToValue) are emitted as IRParams into the IRGeneric body block (12782-12864) so anything referencing them is parented under the generic, not the module; (c) hoistable insts (specialize is hoistable) merge every operand+result-type parent (slang-ir.cpp:1692-1716) and addGlobalValue accepts IRGeneric-parented blocks (slang-ir.cpp:2632/2664) — so an env-dependent value is never DIRECTLY module-parented. Therefore parent==moduleInst ⇒ env-independent. Codex second-opinion concurred SOUND.

ioDiff convention (12098-family, re-confirmed at d0a7a16): tree-wide grep of `*ioDiff =` (bare assignment, not += or ++) across source/slang returns EXACTLY ONE hit — ModifiedType::_substituteImplOverride slang-ast-type.cpp:2194 `*ioDiff = 1;`. It accumulates children into a SEPARATE local `int diff` and only writes the absolute `1` after `if(!diff) return this;`, so it loses no child diff. NO override reads *ioDiff as an rvalue. Safe under the wrapper (substituteValWithCache passes a fresh diff=0 scratch to the override, then does *ioDiff += diff) because the consumer contract is boolean (zero vs nonzero), not magnitude.

How to catch it: for any memoization PR, (a) prove the two cache-populating dispatch paths are semantically identical when they can collide on the same key; (b) for a cross-env cache, enumerate ALL context fields and show the guard excludes every env-varying one either by the guard predicate or by structural IR-parenting; (c) tree-wide grep the counter/out-param convention, not just val.cpp/decl-ref.cpp.

Fix: n/a (audit found CLEAN on all four probed questions).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784074914750-approver-challenger-miss-val-lowering-memoization-.md`_
