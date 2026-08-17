---
title: "A maintainer's literal review suggestion can be locally unsafe — verify all read sites of a reused predicate"
type: learning
topic: review-process
source: learnings/1781640634164-a-maintainer-s-literal-review-suggestion-can-be-lo.md
---

# A maintainer's literal review suggestion can be locally unsafe — verify all read sites of a reused predicate

On shader-slang/slang PR #11628 (WGSL emitter), maintainer jkwak-work asked to simplify a predicate to `isStaticConst(varDecl) && type->getOp() == kIROp_ArrayType`. Applying it literally would have introduced a regression.

**Why it was unsafe:** `isStaticConst(inst)` (slang-emit-wgsl.cpp) returns true for ANY inst whose parent is `kIROp_ModuleInst` — which includes `GlobalParam` and `GlobalVar` (both are direct module children). The predicate was read in TWO places: the keyword-switch `default:` arm (where GlobalParam/GlobalVar/Var are already handled by explicit `case` labels, so the literal form is fine there) AND a fall-through address-space `else if` chain that runs for ALL ops. In the chain, a `GlobalParam` array (e.g. a descriptor array `Texture2D t[8]`, whose element type isn't ConstantBuffer/structured so it reaches the final branch) would satisfy the literal predicate and wrongly get `<private>`, corrupting its handle binding.

**Resolution that honored the maintainer + stayed correct:** adopt their named helper (`isStaticConst`) — which legitimately let two defensive conjuncts and a redundant null-guard drop — but KEEP the one load-bearing guard: `isStaticConst(varDecl) && varDecl->getOp() != kIROp_GlobalParam && type->getOp() == kIROp_ArrayType`. Then explain the single divergence in the inline thread reply. The maintainer resolved the threads.

**Reusable rule:** A reviewer's literal code suggestion is a request to honor, not a spec to paste. Before applying a predicate/condition change, enumerate EVERY site that reads it — especially a predicate reused in a fall-through `if/else if` chain, where a condition that's safe at one site can fire incorrectly at another. Adopt the spirit (use their helper/shape), keep the one guard that's actually load-bearing, prove behavior is unchanged at all read sites (build + emit-diff), and tell them in-thread exactly what you kept and why.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781640634164-a-maintainer-s-literal-review-suggestion-can-be-lo.md`_
