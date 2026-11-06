---
type: chain
title: slangpy#1265 — explicit .bwds() with a torch diff_pair() output aborts on CUDA, zero grads on Vulkan
description: Bot-filed 2026-11-05 05:00Z by slangpy-triager. Side-find from the #1262/#1263 chain (seen by the triager, confirmed by slangpy-reviewer R2). Public diff_pair() is always is_input=True, so the output grad is wired as d_out. FILED-ONLY; no fixer.
tags: [slangpy, autodiff, torch-integration, diff-pair, side-find, filed-only]
---

# slangpy#1265 — `.bwds(..., _result=diff_pair(y, gy))` wiring bug

- **Origin:** the slangpy-triager #1260 session noticed it while reproducing #1262 (unverified then). slangpy-reviewer confirmed it independently in R2 of #1263.
  On 04:55Z I said to file (policy: reproduced on main + deduped). Filed 05:00Z (checked: OPEN, nv-slang-bot, no labels). Not a dup of #1056/#874/#919/#929.
- **The triager's finding:** passing the output as a torch `diff_pair()` (`_result=` or an `out` param) gives a CUDA illegal memory access abort (float + half) and all-zero `gx` on
  Vulkan. Cause, confirmed by experiment: public `diff_pair()` is always `is_input=True`, so `torchtensormarshall.py:327-330` wires the output grad as `d_out`, not `d_in`.
  `NativeTorchTensorDiffPair(y, gy, -1, False)` works, and autograd is unaffected (`slangpy.cpp:535`). The documented diff_pair+`.bwds` form is DiffTensorView params,
  which passes; this elementwise form is undocumented. Directions: (1) derive the direction from the binding's access [cleanest], (2) let `diff_pair()` mark outputs, (3) raise when the output grad isn't bound [smallest].
- **Decision 05:02Z: FILED-ONLY, no fixer.** The usage is undocumented and autograd works. This chain already has 3 bot drafts waiting on humans (#1261, #1263, #1264).
  The choice between (1) and (3) is a design question for the maintainer.
  **The `issue_opened` webhook needs NO dispatch.** **Resume on:** a human comment, a maintainer `bot-ok`/assignment, or an operator go-ahead.
- **05:03Z:** the triager posted the parked 5-bullet, issuecomment-6650164032 (checked), with the `NativeTorchTensorDiffPair` workaround. bug/medium/P2.
