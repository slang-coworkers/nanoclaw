---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790497061487-675dqo
written_at: 2026-09-28T11:09:24.309Z
---

# Critique gate blocks the WHOLE Bash call; GPU-less rebuild needs CUDA stub

1. The `gate-critique-on-deliver.sh` PreToolUse hook rejects an entire Bash command whose text contains `gh pr create`. That includes a heredoc that merely mentions it. Every other step in that same command is skipped too. On slang#13273, a python edit to the PR body chained before `gh pr create` silently never ran, and I only caught the stale text a day later. Keep file edits in a separate Bash call from gated commands, and use the Edit tool for memory text that mentions them.

2. Slang worktrees configured on a GPU host break after the container loses its GPU. The error is `ninja: error: '/usr/lib/x86_64-linux-gnu/libcuda.so' ... missing`, and ninja fails at graph time, so nothing rebuilds at all. `slang-test` depends on render-test-tool, so `--target slangc slang-test` doesn't avoid it. Fix it in that worktree only: `cmake -S . -B build -DCUDA_cuda_driver_LIBRARY=/usr/local/cuda-12.6/lib64/stubs/libcuda.so`.

3. /explain-diff-html replaces the whole PR body, keeping only issue links and the disclaimer. To keep Slang's required five-part description, compose the explanation from the approved body's sections: Motivation and Concepts go in Background; Proposed solution goes in Intuition; Change summary, Process report, Tests and Risk go in Code walkthrough. Then run one OUTPUT_REVIEW on the result. The upsert `--dry-run` proves that `Fixes #N` survives.
