---
type: chain
title: slangpy#1271 — scalar vs float3 tensor perf gap; from_numpy vector dtype
description: Human-filed (manurare) 2026-11-11. Question + docs defect + latent from_numpy bug + perf enhancement. Triaged on L40S; slangpy-fixer owns A1 (from_numpy stride check) + docs fix (Refs #1271); default group size parked for the maintainers.
tags: [slangpy, tensor, from_numpy, numthreads, perf, docs]
resource: raw/slangpy-1271-triage-memo.md
---

# slangpy#1271 — scalar vs vector tensor performance

- **Filed** 2026-11-11 by manurare (human, external, slangpy 0.43.1). No labels, no assignee (events checked). R6: no hold.
  `grep 1271 memory/slang/` had only numeric false hits. Dispatched slangpy-triager 12:24Z, session `sess-1794399991302-pyfhvv`,
  thread `gh-issue-shader-slang/slangpy-1271`.
- **Triage (12:38Z), the triager's finding:** Q/P2. The reporter's gap is mostly first-call compile folded into the mean;
  warm submit cost is equal (61–63 µs Vulkan, 42–46 µs CUDA). The real GPU-side gap (20M: 1132 vs 747 µs) comes from the
  generated kernel's default `[numthreads(32,1,1)]` (`slangpy/core/generator.py`). The workaround `call_group_shape((64,3))` closes it.
  Defects: (a) `from_numpy(plain (N,3), target_slang_dtype="float3")` has no stride/shape check in the non-structured path of
  `src/slangpy_ext/func/tensor.cpp`, so it builds an (N,3)-of-float3 tensor on a 12N-byte buffer; (b) the docs example
  `float_tensor.view(shape=, dtype="float3")` (`docs/src/tensors/python.rst`) does not exist (TypeError).
  **Checked on main myself 11-11:** the numthreads(32) default at generator.py:769/787, the docs `view(..., dtype="float3")` example, and that the
  non-structured from_numpy branch checks only `nbytes % item_size` and the strides. Memo: [raw/slangpy-1271-triage-memo.md](raw/slangpy-1271-triage-memo.md).
- **Fixer:** the triager handed off directly. slangpy-fixer session `sess-1794400735500-sybcgh` (created 12:38Z) owns A1 + the docs fix, `Refs #1271` (not Fixes).
  The default group size (C1 raise the default / C2 expose `thread_group_size`) is parked on the issue for a maintainer decision.
  The ready-flip goes on the weekly list (P2).
- **GitHub artifact:** triage reply comment 6796204282 posted 12:46:46Z by nv-slang-bot (I checked it; 6.3k chars, answer-first; codex OUTPUT_REVIEW took 2 rounds).
  It covers the warm-up/sync benchmark, the numthreads(32) cause + `call_group_shape((64,3))`, the three float3 routes, the two defects (fix as `Refs #1271`), and the C1/C2 maintainer question.
- **State (12:47Z):** the fixer is building on `fix/issue-1271` (repro confirmed at base). The triager owns a one-shot C1/C2 re-check on 2026-11-14 13:00Z,
  and it forwards the [Triage Resolution] when the [Fix Report] lands. Watch for the fixer's PR + `report_pr_created`.
- **PR [#1272](https://github.com/shader-slang/slangpy/pull/1272)** opened as a draft 11-11 ~13:00Z by nv-slang-bot. Head `fix/issue-1271` @`369801cf`, base main, 3 files
  (`tensor.cpp` from_numpy size check, `python.rst` docs fix, `test_tensor.py`). `closingIssuesReferences` is empty, so it won't close #1271 (checked).
  pr-mapping → slangpy-fixer `sess-1794400735500-sybcgh` (checked). The fixer's issue status comment is 6796554837. Next: slangpy-reviewer, then the ready-flip goes on the weekly list (P2).
- **[Triage Resolution] (13:48Z), the triager's report:** partial by design. #1272 @`f45ab617` is a draft, `closingIssuesReferences` is empty, and CI shows 14 pass, 1 skipped, 2 pending (checked).
  The reviewer verdict was APPROVE_WITH_NITS and the nits are applied. That review is not a GitHub review object: the PR's `reviews` list is empty (checked). The issue status comment 6796554837 is updated in place.
  **Open maintainer decisions on #1271:** C1 raise the default group size above 32; C2 make `thread_group_size` apply to functional calls; A2 make `from_numpy` fold the last dim into a vector type, like `from_torch`.
  The triager's one-shot re-check is 2026-11-14 13:00Z. The ready-flip goes on the weekly list (P2). **Chain state: PARKED on human review + maintainer decisions.**
- **Side find (13:48Z, the fixer's finding):** `Tensor.copy_from_numpy` into a `bool` tensor on Vulkan silently corrupts data (1-byte values go into 4-byte slots; only vectors get padded). It predates #1272.
  I told the triager to reproduce on main, dedupe, and file if verified, per the filing policy. No fixer: it is filed-only. Its `issue_opened` webhook needs **no dispatch** (chain-owned).
- **Side find filed as [slangpy#1273](https://github.com/shader-slang/slangpy/issues/1273)** (11-11 13:59Z, nv-slang-bot, checked: no labels, no assignee, no closing keyword).
  The triager reproduced it on main 639a016d + the 0.43.1 wheel. On Vulkan it breaks both directions: `tensor_copy_from_numpy` copies raw bytes with no item-size check, and `to_ndarray`
  computes the stride from the 4-byte Slang bool but builds a 1-byte numpy bool. CUDA/CPU are correct. Not a dup of #899 (from_numpy bool support; its fix would route into this bug), #274 or #163.
  **FILED-ONLY, no fixer.** Its `issue_opened` webhook needs **no dispatch** (chain-owned side find). It resumes on a human comment or assignment, or when #899 work starts.
- **#1273 taken by maintainers (11-11 18:44Z, checked):** jhelferty-nv assigned kaizhangNV + ccummingsNV and set an issue type. At 18:45:56Z they asked
  "@ccummingsNV Is this supposed to be working?" (comment 6804377710). It arrived as a `pr_mention` webhook, but the GitHub body has no `@nv-slang-bot`; it is addressed to ccummingsNV.
  **No dispatch, no bot post.** #1273 is held for its maintainer assignees (rung 4). The bot acts only on an explicit `@nv-slang-bot` ask there.
