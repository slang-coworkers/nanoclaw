---
title: "Correct evidence in the same artifact shields a wrong explanation — verify the mechanism separately from the measurement"
type: learning
topic: verification
source: learnings/1785883064671-correct-evidence-in-the-same-artifact-shields-a-wr.md
---

# Correct evidence in the same artifact shields a wrong explanation — verify the mechanism separately from the measurement

Addendum to `1785877147674` ("a right conclusion reached by a wrong mechanism draws no pushback"). That one explains why nobody pushes back. **This adds why the wrong mechanism gets actively shielded: co-presence with correct evidence inside a single artifact.** A reader who checks the verifiable half finds it correct and stops. The number vouches for the story.

**My instance (shader-slang/slang#12348).** In one message I reported both:

1. A **measurement** — GCC 12 `-O2` emits a live pointer-chase loop for a `paramCount` walk whose only consumer is `SLANG_ASSERT`. Correct, reproducible, and independently reproduced by the fixer.
2. An **explanation** — "`SLANG_ASSERT` → `SLANG_ASSUME` → `[[assume]]`/`__builtin_assume`/`__builtin_unreachable`, all *unevaluated* contexts." **False**, and false in a way that *contradicted the measurement it accompanied*: if the operand were unevaluated, the loop's survival would need some other cause. The evaluation is precisely why it survives.

On this toolchain `__cpp_assume` is undefined (`g++ -dM -E -x c++ /dev/null | grep -c __cpp_assume` → 0), so the live branch is the GCC fallback (`slang-common.h:337-343`): `do { if (!(X)) __builtin_unreachable(); } while (0)` — which **evaluates `X`**.

Nobody questioned the explanation for two exchanges. Anyone spot-checking my asm output would have found it correct. The correct half was load-bearing for the wrong half's credibility.

**Where the false belief came from — a usage contract read as a statement of fact.** `slang-common.h:333` says *"Do not rely on side effects of the condition being performed."* That is guidance to callers (don't *depend* on evaluation, because the `[[assume]]` branch may skip it). It is **not** a claim that any given branch skips evaluation. The wrong reading is the stronger one, and it happened to support my explanation.

**How to apply.**

- **A measurement and its explanation are two claims. Verify them separately.** Reproducing the number does not test the mechanism; they can be independently right and wrong. State them as separable, so a reader knows the explanation still needs checking.
- **Check whether your explanation and your measurement are mutually consistent** before shipping both. Mine were not, and that internal contradiction was detectable without any new data — I just never asked.
- **For "is this operand evaluated?", the only discriminator is a side-effecting operand.** Reading the macro cannot answer it:
  ```cpp
  int calls = 0; int f() { ++calls; return 1; }
  SLANG_ASSUME(f() == 1);   // then print calls
  ```
  → `f() called 1 time(s)` at `-O2`. Same family as `^CMake Error` over `grep -qi error`, and the stringified assert literal over a symbol-name count: **construct an expression that can only be true when the target is true.**
- **Distinguish usage contracts from behavioural facts in headers.** "Do not rely on X" tells you the API permits ¬X somewhere; it does not tell you ¬X holds here. If you need the behaviour, test the configuration you actually compile.
- **Consequence worth knowing generally:** because `SLANG_ASSUME` evaluates, a release build *does* reference and evaluate an unguarded `SLANG_ASSERT` operand. So `#ifdef _DEBUG` around a debug-only computed value must enclose **both** the computation and the assert — guarding only the loop is a hard release error (`error: 'paramCount' was not declared in this scope`), not a warning. Verified by compiling the counterfactual.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785883064671-correct-evidence-in-the-same-artifact-shields-a-wr.md`_
