---
title: "slangpy#1167: new bwds() HANG variant of reverse-loop reconstruction (runtime upper-bound, distinct from #12070 START)"
type: learning
topic: slang-compiler
source: learnings/1789715336893-slangpy-1167-new-bwds-hang-variant-of-reverse-loop.md
---

# slangpy#1167: new bwds() HANG variant of reverse-loop reconstruction (runtime upper-bound, distinct from #12070 START)

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1789707937876-vf4nx4
written_at: 2026-09-18T07:08:56.893Z
---

# slangpy#1167: new bwds() HANG variant of reverse-loop reconstruction (runtime upper-bound, distinct from #12070 START)

SlangPy `Function.bwds()` HANGS (silent non-terminating GPU reverse loop, no exception) when a `[Differentiable]` fn loads a buffer-backed `IDiffTensor`/`DiffTensorView` inside **runtime-dependent control flow** — a runtime upper-bound `[MaxIters]` loop (`for(i<2*radius+1)`), a runtime `if`, or after a runtime `break` (the last two even with a fixed MaxIters). Forward is fine; the same math **unrolled** and the **fixed literal-count** loop both pass ⇒ loop-dependent, in the Slang compiler's reverse-loop codegen (`.bwds()` is a single GPU dispatch, no Python loop).

This is a NEW variant of the reverse-mode loop-carried reconstruction subsystem (`slang-ir-autodiff-primal-hoist.cpp` / `-unzip.cpp`), **distinct from slang#12070 / slangpy#1051** which was the runtime induction *START* (fixed by slang#12299). #1167 is the runtime upper-*BOUND* + if/break case. Regression window pinned by version-flip matrix: SlangPy 0.42.0/Slang 2026.5.2 PASS (grad_sum 320) · 0.43.1/2026.12 HANG · main/2026.17.1 HANG ⇒ **(2026.5.2, 2026.12], STILL unfixed at 2026.17.1** (so a compiler bump alone does NOT fix it). Prime suspect: **slang#12299** (merged 2026-08-03, in-window, rewrote exactly this reverse-loop induction/checkpoint machinery to fix the START sibling) — either an incomplete fix for this shape or the regressing change; unconfirmed.

Two load-bearing gotchas: (1) **No minimal pure-Slang repro was achievable** — scalar-in-loop and differentiable-*value-array* stencils (slangi + slang-test -cpu/-cuda) all PASS. Hypothesis: the trigger is tied to `IDiffTensor`'s **buffer-backed scatter-add adjoint**, a different reverse-IR shape than a value-array `DifferentialPair<float[N]>`. The faithful reproducer to hand the Slang team is the SlangPy `repro.py` + analysis. (2) **A SlangPy regression test MUST use the actual functional-API `IDiffTensor<float,2>` stencil shape** — a simplified `DiffTensorView` reduce (matching the in-tree `diff_square` test) does NOT reproduce and would be a false-green test. And per slangpy#1053, do NOT land a pre-fix hanging tripwire test (wedges CI runners) — prefer enabled-with-fix, or a strict subprocess-timeout xfail only after validating CI device-recovery-after-child-kill.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789715336893-slangpy-1167-new-bwds-hang-variant-of-reverse-loop.md`_
