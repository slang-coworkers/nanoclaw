---
title: "Probe the hazard against a built binary instead of offering the maintainer options"
type: learning
topic: verification
source: learnings/1785935098942-probe-the-hazard-against-a-built-binary-instead-of.md
---

# Probe the hazard against a built binary instead of offering the maintainer options

On shader-slang/slang#11709 (issue #10641, groupshared parameters passed by reference) a maintainer
asked whether a read-only `groupshared` parameter could still admit a copy-in temporary — should we
"use `__constref` and never allow the borrow when the rate is groupshared?"

I had spent two PR comments reasoning about this from code paths and offering him **two options to
choose between** (relax the `RefParamType` invoke check, or accept borrow semantics). That was the
mistake: a built `slangc` was already sitting in the worktree, and the question was empirical.

**What the probe showed.** I wrote the hazard four ways — a non-groupshared local as the argument, a
pure r-value, `gsv.xz` (the *exact* non-contiguous-l-value case that the `createVar` temp at
`slang-lower-to-ir.cpp:3536` exists to serve), and an implicit `int`→`float` conversion of a
groupshared l-value. **All four were rejected by diagnostic E30711 during semantic checking, before
lowering ever ran.** The hazard was already closed — by a different compiler phase than the one I
was arguing about. Neither option I'd offered was needed.

**Three things that made the probe trustworthy:**

1. **A positive control.** The legitimate call emitted
   `float readIt_0(groupshared float4 arr_0[8])` — reference preserved, `groupshared` intact. Four
   rejections *without* that control would have been consistent with "the check rejects everything."
2. **Probing where the guard could be SKIPPED, not just where it fires.** The check reads a
   conditionally-null `paramDecl`, so I also tested dynamic dispatch through an `interface`, a
   generic `<let N:int>` parameter, and the explicit `__constref` spelling. That is what licensed
   the word "closed" rather than "closed for the shapes I happened to try."
3. **Distrusting my own subagent's citation.** It cited `builder->getGroupSharedRate()`; my first
   grep found nothing and I nearly reported the citation as invented. The symbol is real — my grep
   scope was wrong, which I only learned because my *control* (`getRateQualifiedType`, a method I
   knew existed) also returned nothing. A negative from a search whose scope you haven't controlled
   is not a negative.

**A second bug fell out of it.** E30711's own text promises it accepts "a `groupshared` variable, **a
component of one**, or a dereference of a group-shared pointer." Array elements work
(`readV(gs[0])` compiles); a **struct field is wrongly rejected** (`readV(gss.v)` → E30711). Cause:
`getValidTypeForAddressOf` recurses through `IndexExpr` unconditionally but gates the `MemberExpr`
branch on `as<VarDeclBase>(memberExpr->declRef)`, falling through to `nullptr` when that fails — so
"I couldn't determine the address space" becomes indistinguishable from "not groupshared."

**Two transferable rules:**

- **When a maintainer asks "can X still happen?", construct X.** Check for a built binary before
  framing a decision for them. Asking someone to choose between options that a five-minute probe
  would eliminate spends their attention on your unfinished work. A rejection with a specific
  diagnostic code beats any code-path argument.
- **Parse a diagnostic you authored as a spec.** Every form the message says it accepts is a test
  case you owe; every form it says it rejects likewise. The clause I never tested is the one that
  was broken — and it went unchecked precisely *because* I wrote the wording myself. Watch for
  helpers that recurse unconditionally on one expression form but conditionally on a sibling: the
  conditional branch silently returns "no" where it means "unknown."

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785935098942-probe-the-hazard-against-a-built-binary-instead-of.md`_
