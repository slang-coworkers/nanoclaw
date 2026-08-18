---
title: "Slang: use-site propagation of user-defined derivative [require] under-constrains transitive differentiation"
type: learning
topic: slang-compiler
source: learnings/1782882850345-slang-use-site-propagation-of-user-defined-derivat.md
---

# Slang: use-site propagation of user-defined derivative [require] under-constrains transitive differentiation

**Context:** Reviewing PR #11872, which fixes #11859 by moving a user-defined derivative's `[require(...)]` capability off the **primal** (old: two loops in `SemanticsDeclCapabilityVisitor::visitFunctionDeclBase`) and onto the **differentiation use-site** (new: `CapabilityDeclReferenceVisitor` member/HOI hooks). The direction is correct — issue #11859's own "Expected Behavior" endorses it ("checked when `bwd_diff(testC)` causes `testCBwd` to be used"). But the *layer* has a soundness gap.

**The finding (non-obvious):** Capability checking in Slang is **AST-only** — the synthesized IR derivative is **never** capability-checked. Verified: `grep -rlnE "[Cc]apabilit" source/slang/slang-ir-autodiff*.cpp` → empty; `slang-ir-late-require-capability.cpp:102-145` only handles explicit `__requireCapability`. So an AST use-site hook that only fires on a *direct* syntactic `fwd_diff(p)`/`bwd_diff(p)` (→ rewritten to `p.fwd_diff`/`p.bwd_diff` member access by `convertHigherOrderExprToLookup`, slang-check-expr.cpp) **cannot** see transitive differentiation:

```slang
[Differentiable] float g(float x){ return testC(x); }  // testC has [require(spirv)] user-defined bwd derivative
bwd_diff(g)(...)   // source has only g.bwd_diff; g has no user-defined derivative
```
→ `testCBwd`'s `[require(spirv)]` is never joined → compiles clean on `-target hlsl` and auto-diff still emits the spirv-only derivative. **Silent false-negative.** The OLD primal-side model caught this for free: the requirement sat on `testC`, so `g` (calling `testC`) inherited it via ordinary call-graph capability inference (`visitReferencedDecls` over the body; each referenced decl's `inferredCapabilityRequirements` joined). Transitive diff is the *primary* user-defined-derivative use case, so the gap matters.

**Second, related vector:** the old *forward*-placement loop (`[ForwardDerivative]`/`[BackwardDerivative]` modifier on primal) was **unconditional**; only the inverse-placement (`[*DerivativeOf]`) loop was gated on `[require]`. A unified use-site path that gates BOTH on `[require]` silently drops a forward-placement derivative that only *infers* a capability (no explicit `[require]`) — even for direct diff.

**Takeaways for reviewers:**
- When a capability/requirement moves from a callee/primal to a "use-site," always ask: does the old location ride **call-graph inference** (which handles transitivity), and does the new hook? An AST syntactic hook only sees the *outermost* operator, never transitively-materialized inner derivatives (those appear only in IR, post-capability-check).
- **DeepWiki got this wrong** — it claimed transitive propagation works and the IR derivative is capability-checked. It conflated *differentiability* checking (`CheckDifferentiabilityPassContext`, `isInstCarryingOverDiff`) with *capability* checking (`SemanticsDeclCapabilityVisitor` / E36107). Verify pipeline claims against source, not DeepWiki.
- The `[require]` gate on derivative-capability propagation is load-bearing (prevents core-module compile abort: ~64 `[require]`-free inverse-placed derivative families on math builtins). Any refactor of this path must preserve it AND confirm the core module re-embeds.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782882850345-slang-use-site-propagation-of-user-defined-derivat.md`_
