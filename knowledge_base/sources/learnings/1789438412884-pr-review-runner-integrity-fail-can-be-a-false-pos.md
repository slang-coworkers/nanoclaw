---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789436758949-21iagk
written_at: 2026-09-15T02:13:32.884Z
---

# PR-review-runner INTEGRITY-FAIL can be a false positive from concurrent reviews racing on the shared slang/tmp

**Symptom:** `slang-pr-review-runner`'s `compose-and-run.sh` (Reviewer A) emitted `INTEGRITY-FAIL.txt` listing files from a *different* PR (Vulkan `vk-buffer.cpp` / `test-buffer-from-handle`), and `/workspace/agent/slang/tmp/context.json` recorded the **wrong PR number** (868 with head/diff_sha for 868), even though I invoked it with `--pr 867 --repo shader-slang/slang-rhi`. Yet A's `final-review.md` content was correctly about 867.

**Root cause:** `compose-and-run.sh` writes `tmp/pr-diff.patch` and `tmp/context.json` under the **shared** `REPO_ROOT=/workspace/agent/slang` checkout and does NOT isolate them per run (unlike `slang-clarity-review-runner`'s `run-clarity.sh`, which creates its own `wt-*` git worktree). When a sibling session runs a review of another slang-rhi PR concurrently, its run overwrites those shared `tmp/` files. The post-run integrity check (which reads `tmp/pr-diff.patch` vs `gh pr view <mine> --json files`) then compares the *other* run's diff against my PR's files → false-positive INTEGRITY-FAIL. `context.json`'s `pr`/`head_sha`/`diff_sha256` are likewise polluted.

**Why the review itself was still valid:** the model reviews via a live `gh pr diff <PR>` driven by its prompt (PR number), not by the shared `tmp/pr-diff.patch`. And `compose-and-run` captures the correct diff into the run's OWN dir as `pr-diff.reference`.

**How to distinguish false-positive from a real wrong-PR review (do this, don't stall):**
1. `grep '^+++ b/' <run_dir>/pr-diff.reference` → confirm it lists YOUR PR's files.
2. `sha256sum <run_dir>/pr-diff.reference` and compare to a fresh `gh pr diff <PR> -R <repo> | sha256sum`. Byte-identical ⇒ A reviewed the right diff.
3. Confirm `final-review.md` content matches your PR's subject/lines, and PR head is unchanged.
If all agree, the INTEGRITY-FAIL is a shared-tmp race. In the machine-readable result, set `diff_hash` to the **verified** `pr-diff.reference` sha (NOT `context.json`'s value), keep `reviewers_complete:true` (drift, i.e. non-COMMENT review submissions, is a separate metric), and disclose the race prominently in the combined report.

**Prevention for concurrent runs:** run `compose-and-run.sh` with an isolated `REPO_ROOT` — e.g. `REPO_ROOT=/workspace/agent/wt-<pr>-revA` pointing at a dedicated `git worktree` of the slang checkout — so its `tmp/` cannot be clobbered. (Mirrors what the clarity runner already does.) A runner-side fix would be to move `tmp/context.json`/`pr-diff.patch` into the per-run `RUN_DIR`.

Context: observed 2026-09-15 reviewing slang-rhi#867 (CUDA copy-skip) while #868 (Vulkan) was reviewed concurrently on a sibling session.
