---
type: project
name: project_13868_floatasint_fold_through_bitcast_call
description: "HUMAN-OWNED, nothing dispatched (10-22 ~14:05Z). slang#13868 (albertrodriguezclo, external): visitFloatBitCastExpr folds __floatAsInt(f(lit)) for ANY one-argument call on a literal as if f were a float conversion, so __floatAsInt(bit_cast<float>(0x3F800000u)) / asfloat(...) gives 1316880384 and __floatAsInt(sqrt(4.0f)) gives the bits of 4.0f (confirmed on master 0bd71cd709, slang-check-expr.cpp ~7423-7459). Author's fix PR #13869 (fix/floatasint-bitcast-fold, +64/-1, reviewer dshreiner-nv). No overlap with our PR #13816's files."
---

# slang#13868: `__floatAsInt` folds a bit cast of a literal as a numeric conversion

**10-22 13:57:16Z `issue_opened`.** Main webhook session `sess-1792677439179-bp2tjd`. Live read at ~14:00Z: open,
0 comments, no labels, body unchanged from the payload. github-actions auto-assigned jhelferty-nv.

**Claim checked on master `0bd71cd709`.** In `SemanticsExprVisitor::visitFloatBitCastExpr`
(`source/slang/slang-check-expr.cpp` ~7423–7459), the fold takes any `InvokeExpr` with one argument. If the
argument is a `FloatingPointLiteralExpr` or an `IntegerLiteralExpr`, it folds the bits of that literal converted to the
float type. The code never checks the callee, so `bit_cast<float>`, `asfloat` and `sqrt` all take the same path. The
report is accurate.

**Ownership.** The timeline shows a `cross-referenced` event from **PR #13869**, which the author opened 37 s after the
issue ("Fixes #13868"). It is not a draft, and dshreiner-nv is the requested reviewer. It changes 3 files (+64/−1)
and folds through the call only for a `TypeCastExpr` or a constructor call.

**Disposition: held, nothing dispatched or posted.** A human filed the issue with their own fix PR, so a bot triage or
fix would duplicate their work. This is the same pattern as the author's #13845/#13846, #13847/#13848 and
#13853/#13855 ([project_13845_bitcast_fold_quiets_signaling_nan](project_13845_bitcast_fold_quiets_signaling_nan.md),
[project_13847_target_ignore_capabilities_e36107](project_13847_target_ignore_capabilities_e36107.md)).

**Link to our chains:** none. Our PR #13816 (#13635, WGSL `asfloat` NaN/Inf) does not touch `slang-check-expr.cpp`. No
timer: nothing of ours waits on #13869.

**Resume on:** a maintainer asking the bot to act on #13868/#13869.
