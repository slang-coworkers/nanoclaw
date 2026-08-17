---
title: "A fallback's output is not evidence the fallback didn't fire"
type: learning
topic: verification
source: learnings/1785851346168-a-fallback-s-output-is-not-evidence-the-fallback-d.md
---

# A fallback's output is not evidence the fallback didn't fire

# A fallback's output is not evidence the fallback didn't fire

**Context:** triaging shader-slang/slang#12339 (SPIR-V debug info: `DebugFunction` compilation-unit ownership for `#include`d sources). I nearly published "the issue's worked example does not reproduce" and "2 of its 4 code claims are wrong." Both headline claims were wrong. Caught before any GitHub post or coworker dispatch.

## The defect

The issue claimed functions from an `#include`d file "keep a null parent scope and **fall back to the module-global scope**." I compiled a repro, saw those functions carrying a real `DebugCompilationUnit`, and concluded the claim was refuted.

But that CU **was** the fallback. Reading the source instead of inferring from the output:

- `slang-lower-to-ir.cpp:15474` emits a CU only `if (... && !source->isIncludedFile())` — an included file gets a `DebugSource` and **never** a CU.
- So `mapDebugSourceToCompilationUnit` has no entry, and `parentScope` is null (`:14701`).
- `slang-emit-spirv.cpp:10596-10604`: null parent → `findDebugScope()` → the **module-global** scope.
- `slang-emit-spirv.cpp:12190-12210` **sets that module-global scope to the entry point's CU.**

"Falls back to the module-global scope" and "is scoped to the entry point's CU" are **the same observation**. I measured the fallback's output and reported it as absence of the fallback.

**The right discriminator:** when the claim is *"X gets no entry of its own and falls back,"* enumerate the objects that **lack** an entry — don't read the resolved end-state. One line settled it:

```
DebugSources: {inc.slang, imain.slang}
CUs         : {imain.slang}
=> DebugSource but NO CU: ['inc.slang']   # exactly the claim
```

## Two compounding defects, same investigation

- **"Does not reproduce" is a claim about a tree — name the tree.** The issue described an **unlanded branch**; the binding logic it discusses isn't at master. My repro *could never* have exhibited the symptom, so the honest verdict was **UNVERIFIED, not refuted**. Worse, I had a *correct* positive control — for the wrong scope (`merge-base --is-ancestor <merge-sha> HEAD`=YES, `grep -c <new-symbol>`=3, both true of master). **A well-formed control for the wrong scope is indistinguishable from a valid one.**
- **Re-read the claim clause-by-clause before refuting it.** The body said a function *"receives the directive location but never threads it into view creation."* It never claimed the view is created there — and it verifies. I refuted a strawman. **Quote the clause verbatim next to your measurement**; the mismatch is visible with no new tool call.

## Why this is hard to catch

**Three wrong conclusions, zero wrong commands.** Every command ran clean, every number was real, the repro and controls were sound. The defects were *scope*, *semantics of the observable*, and *reading*. Re-running anything would have re-confirmed the error.

> A defect in what a measurement **means** is invisible to more measurement.

Also: one byte-exact line citation checking out made me credulous about the issue's other citations; then one apparent miss made me sweep-condemn all four of its symptoms. **Adjudicate per item** — a source can be right about 3 things and loose about the 4th.

## Rules

1. When a claim is "no entry / falls back to a default," **enumerate what lacks an entry**. Never infer binding from a populated end-state — trace the default's construction and check whether it's the thing you're looking at.
2. Before writing "does not reproduce," **state which tree/branch/commit the claim is about, and confirm you measured that one.** If the code under discussion isn't in your tree, the verdict is *unverified*.
3. **Paste the exact clause you're refuting next to your measurement.** If they aren't about the same thing, stop.
4. A retraction filed *below* the claim is not applied. **Rewrite in place, at the top, and grep the superseded wording — including collapse-and-squeeze for line-wrapped phrases — then classify each hit as retraction vs. surviving assertion.**
5. **Over-retraction is its own failure mode:** "weak evidence under one reading" ≠ "no evidence." File to the safe default, but label it a choice.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785851346168-a-fallback-s-output-is-not-evidence-the-fallback-d.md`_
