---
name: feedback_a_constraint_stated_as_a_remedy_scores_a_correct_fix_as_wrong
description: "I dispatched a binding constraint as an IMPLEMENTATION ('scope the guard to reachable insts'). The fixer met the REQUIREMENT by a better route (move an existing DCE pass earlier). A reviewer checking my literal words would have scored a correct fix non-compliant. State constraints as behaviour + the test that proves it."
metadata:
  node_type: memory
  type: feedback
---

# A constraint stated as a REMEDY scores a correct fix as non-compliant

**Instance (slang#12440 → PR #12464, measured 2026-08-11T12:1xZ).** I dispatched slang-fixer with a
constraint I called *binding*:

> EMITTER CAST IS SAFE AS-IS; **THE GUARD NEEDS REACHABILITY/LIVENESS SCOPING.** Do NOT ship the
> both-sites patch unchanged.

The fixer shipped something that contains **no reachability scoping anywhere**. It moved the
existing `eliminateDeadCode` call from just *after* `checkGetStringHashInsts` to just *before* it
(`source/slang/slang-emit.cpp`), so the leftover inlined-helper body is gone before the check walks
the module.

**That is not a workaround — it is the better fix.** Teaching the checker liveness would duplicate
`eliminateDeadCode`'s roots, `KeepAlive` handling, CFG reachability, weak references and option
behaviour. The reorder reuses the pass that already encodes all of it.

## Why this is dangerous rather than merely imprecise

The gate prompt I wrote instructed the reviewer to check *"(a) guard scoped to surviving/reachable
insts"*. A reviewer doing exactly as told, competently, **reports check (a) UNMET** — because the
literal artifact I named is absent. The diff meets the requirement (`uint h(String s){return
getStringHash(s);}` called as `h("aaa")` still compiles) by other means.

⇒ ⭐⭐⭐**A constraint phrased as an implementation converts "did the behaviour hold?" into "did you
build the thing I imagined?" — and the second question has the wrong answer for every superior
solution.** The cost lands on the *fixer*, who gets a rejection for doing better, and it arrives
with my authority attached because I labelled the constraint binding.

## The fix to the practice

Write the constraint as **the behaviour that must hold + the test that proves it**, and mark the
remedy as a hypothesis if you name one at all:

```
REQUIRED: `h("aaa")` (literal through a helper) must still compile to uint(807729185).
           The both-sites patch as written reports E41023 on it -- I built it and measured that.
HYPOTHESIS (not binding): scoping the guard to reachable insts would do it. Any route that
           preserves the REQUIRED behaviour is acceptable.
```

I already had the right material to do this: I had **built** the failing patch and **measured** the
exact regressing shader. The requirement was in my hand; I shipped my guess about the cure instead.

⇒ ⭐⭐**When you have a measured failing case, the case IS the constraint. Naming a cure alongside it
adds nothing and subtracts the solution space.**

## Same family, different scope

This is the wrong-scope pattern again — see the ANCHOR F carve-out in `MEMORY.md` and
[[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]]: **each of these rules was
right about what it named and wrong about what it covered.** Here the constraint was right about
the *regression* and wrong about the *set of fixes that avoid it*. Check a constraint's boundary at
the moment you write it, not when someone reports it unmet.

⚠️**Detector, cheap:** after writing any constraint, ask *"could a better fix violate this
sentence?"* If yes, the sentence is a remedy, not a requirement. Rewrite it as the observable.

Chain: [[project_12440_getstringhash_nonliteral_crash]] ·
[[project_12464_getstringhash_nonliteral_e41023]]
