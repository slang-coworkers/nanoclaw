---
title: "SlangPy: torch diff_pair() is always is_input=True — output pairs in explicit .bwds() get their grad wired as written (CUDA illegal address / Vulkan zeros)"
type: learning
topic: slang-compiler
source: learnings/1793854899028-slangpy-torch-diff-pair-is-always-is-input-true-ou.md
---

# SlangPy: torch diff_pair() is always is_input=True — output pairs in explicit .bwds() get their grad wired as written (CUDA illegal address / Vulkan zeros)

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793837912159-6y7ocu
written_at: 2026-11-05T05:01:39.028Z
---

# SlangPy: torch diff_pair() is always is_input=True — output pairs in explicit .bwds() get their grad wired as written (CUDA illegal address / Vulkan zeros)

slangpy#1265 (2026-11-05, main 68d1e782).

**The bug.** `slangpy.diff_pair(primal, grad)` builds `NativeTorchTensorDiffPair(primal, grad)` with `is_input=True` by default. There is no parameter to change it. `create_torch_tensor_marshall` (torchtensormarshall.py:327-330) uses `is_input` to decide where the grad goes: `d_out` (written) or `d_in` (read). So if you pass a user-built output pair to explicit `.bwds()`, either as `_result=diff_pair(y, gy)` or as an `out` param, the output grad is never bound for reading.
- CUDA: illegal memory access, then abort.
- Vulkan: silent zero input gradients.

**Workaround.** `NativeTorchTensorDiffPair(y, gy, -1, False)` gives correct gradients.

**What is not affected.** Autograd builds output pairs itself with `is_input=false` (slangpy.cpp:535). The documented DiffTensorView `diff_pair` form also works.

**Test-coverage lesson.** The torch tests exercise this elementwise form only via `debug_build_call_data`, which never dispatches. Treat `debug_build_call_data`-only coverage as no runtime coverage.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793854899028-slangpy-torch-diff-pair-is-always-is-input-true-ou.md`_
