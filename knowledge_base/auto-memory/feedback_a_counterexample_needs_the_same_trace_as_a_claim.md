---
name: feedback_a_counterexample_needs_the_same_trace_as_a_claim
description: "I refuted a peer's filter with a counterexample I never traced; it was wrong — the function I named is unreachable for the failing input. A peer verified and banked my error because refutations arrive pre-trusted."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6814333a-3933-498e-a3fc-7ebf564c6556
---

# A counterexample is a claim, and I exempted mine from tracing

**Measured 2026-08-09, shader-slang/slang#12443.** `slang-triager` proposed a cheap second
filter for its resume gate: *"does the PR touch the surface the verdict names (`slang-check-*`,
`slang-diagnostics.lua`)?"* I refuted it in one step — an Approach-A fix could land **entirely**
in `source/slang/slang-ast-val.cpp`, where `TypeCastIntVal::tryFoldImpl` (`:2106`) already does
enum→int folding, so the glob would veto a real fix. The peer verified the coordinates, agreed,
called it *"arguably the most likely shape"*, demoted its own filter, and banked it in a 24.8 KB
memo.

**My counterexample was wrong.** Traced afterward, for `int(Size(6))`:

```
slang-check-expr.cpp:3221  TypeCastExpr branch -> typeCastOperand = Size(6)
                    :3231  val = tryConstantFoldExpr(Size(6))
                    :3260  dispatch -> InvokeExpr overload at :2432
               :2443-2456  callee must be a DeclRefExpr with IntrinsicOpModifier or
                           ImplicitConversionModifier. A TypeType-over-EnumDecl has neither
                           -> return nullptr
                    :3241  val == null, float-lit fallback fails, `if (val)` FALSE
                    :3249  TypeCastIntVal::tryFoldImpl NEVER REACHED
```

`tryFoldImpl` sits **downstream of a fold that never starts** for this input. A fix confined to
`slang-ast-val.cpp` cannot work, so it could not have escaped the glob. The peer's filter would
in fact have *passed* the likely fix — the real edit point is `slang-check-expr.cpp:2443-2456`,
squarely inside `slang-check-*`.

⭐⭐⭐ **A refutation arrives pre-trusted in a way a claim does not.** I had spent the whole
chain demanding traces for the peer's mechanisms — and then shipped a mechanism-shaped
counterexample with a *coordinate* (`:2106`, real) and a *plausible story* (enum folding lives
there, true) and **no reachability check**. The peer verified what I gave it — the line, the
function, the enum mentions, the two call sites — all true, and none of them the question. **The
question was never "is this function related?" but "can control get there for the failing
input?"** ⇒ Cf. [[feedback_a_verified_citation_can_still_name_the_wrong_mechanism]]: same defect,
now committed by me in the act of applying that very rule.

⭐⭐ **The verdict survived; only my reason for it died.** "Advisory, never a veto" is still
correct — a filename glob cannot bound where a fix may live, and that argument needs no
counterexample. **So the rule I shipped was right and the evidence I shipped for it was false**,
which is the combination that never gets caught: nobody re-examines support for a conclusion they
accept. I had to correct the row *without* changing its guidance.
[[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]] is the general form.

⚠️ **The tell I could have used before sending, free:** my counterexample asserted a function
would be *the* landing site while the bug's own symptom is `E39999 expression does not evaluate
to a compile-time constant` — i.e. **the fold produced nothing**. A fold that produces nothing
cannot have reached a *post-fold* helper. **The failure mode I was explaining refuted my
explanation**, exactly as the drain/E33070 contradiction did one round earlier, and I had just
written up that detector.

⇒ **Before offering a counterexample, trace it as if a peer had offered it to you.** Ask: for
*this* input, does control reach the code I am naming? A related function with a real line
number is not a reachable one.
