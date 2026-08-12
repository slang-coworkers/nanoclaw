---
title: "Fixing a crash can be a multi-layer cascade — verify each layer before shipping, and stop at the safe boundary"
type: learning
topic: verification
source: learnings/1785026926217-fixing-a-crash-can-be-a-multi-layer-cascade-verify.md
---

# Fixing a crash can be a multi-layer cascade — verify each layer before shipping, and stop at the safe boundary

When fixing a "front-end crashes on X" issue, fixing the crash often *unmasks* deeper layers that the crash was hiding. slang#12210 (`[Differentiable]` on a property getter segfaults) was a clean triaged one-liner but turned into a 3-layer cascade:

1. **L1 (the filed crash):** `getFuncType` cast a `PropertyDecl` parent to `CallableDecl` and null-deref'd. One-line gate fix.
2. **L2 (exposed by L1):** with the crash gone, the getter is rejected at the call site with E41022 — property accessors aren't registered for autodiff the way subscript accessors are. Small localized fix; makes FORWARD-diff work.
3. **L3 (exposed by L2):** with fwd working, `bwd_diff` asserts in the reverse-mode transform (property's `apply_bwd` func type comes out missing the `this` receiver). NOT confidently root-caused.

**The key decision rule that saved this from a bad ship:** Layers 1+2 *without* 3 are STRICTLY WORSE than shipping L1 alone — they convert a clean E41022 diagnostic into an internal assert-crash on `bwd_diff`. So I reverted L2 and shipped L1 only (crash → clean diagnostic), deferring full support to a follow-up. Lesson: when a fix cascades, don't ship a partial that regresses a working-ish path; find the safe boundary (here, "crash becomes a clean diagnostic") and stop there, saving the analysis + ready patches for the follow-up.

**How to detect the cascade:** after the crash fix builds, actually EXERCISE the feature the crash was blocking (here: run `__fwd_diff` AND `bwd_diff` through the getter, not just "does it compile"). Compare against the working analog (subscript accessor) to tell "genuine feature gap" from "wiring bug." Ground-truth layer sizing in the IR (`-dump-ir` param counts), not in subagent speculation — two sizing passes gave two *different* wrong theories for L3, and the IR (property apply_bwd = 0 params vs subscript = 2) was the only reliable signal.

Also: when a proposed fix "mirrors an existing working path," verify the working path's mechanism actually matches your theory. The L3 theory ("add getThisParamType to ApplyForBwdFuncType, like RematFuncType") couldn't explain how the SUBSCRIPT's apply_bwd already gets its `this` when that resolver has no such code — that unexplained gap is the tell that the root cause is elsewhere; don't ship on it.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785026926217-fixing-a-crash-can-be-a-multi-layer-cascade-verify.md`_
