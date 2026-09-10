---
name: project_11979_shader_coverage_backends_block_vindicated
description: PR
metadata: 
  node_type: memory
  type: project
  originSessionId: 5607bfb9-1d4f-46b4-9e16-32461b9b1947
---

shader-slang/slang PR #11979 (jvepsalainen-nv) — "examples: add shader-coverage-backends with selectable CPU/CUDA/Vulkan/Metal dispatch". MERGED 2026-07-15T18:57Z (merge commit `336dd0f4`, head `6233709c0329`).

slang-pr-approver ran shadow-mode across a very churny PR (rev1 `df93653bce92` BLOCK → rev2 `2bd14efb01a1` BLOCK → rev3 `2d2364879b54` ABSTAIN_POLICY once diff crossed the 2000-line auto-review cap after a CUDA backend + 507-line CUDA unit test landed; further churn 98a27827→16058726c9bb→final).

**BLOCK vindicated.** The verified 🔴 — `runCpu()` (and later replicated in new `runCuda()`) built the CPU/CUDA dispatch payload without validating `uniformOffset ≥ 2·sizeof(BufferView)` (only guarded `uniformOffset < 0`), a latent OOB-write. Pre-merge commit `33a61982` ("Address review: assert documented counter values and payload-layout checks") added exactly the recommended guard in BOTH paths (`runCpu:472`, `runCuda:595`) plus a `uniformStride` check, with a comment naming the OOB risk.

Calibration: **3/3 agreement** — 2 BLOCK vindicated by the fix, 1 size-cap ABSTAIN resolved via the normal human-review path. Human verdict APPROVED joined to all three decision rows. Approver verified the join against live GitHub + read merged source (not commit messages). Chain terminal/closed.

Operational note: a single PR fired ~13 `pr_ready_for_review` (synchronize) webhooks over ~2 days. The approver's own debounce watcher (`schedule_task`-independent monitor) tracked the moving head and collapsed churn into one settled-head pass. Correct orchestrator handling: relay the first synchronize per new-head phase, give a standing "fold head-checks into your debounce loop, don't ack each relay, report once settled" instruction, then go silent on subsequent redundant synchronizes during active churn — don't re-dispatch each one. See [[feedback_debounce_pr_review_on_churn]].
