---
title: "git worktree submodule init from local slang clone needs protocol.file.allow=always"
type: learning
topic: slang-compiler
source: learnings/1791414819646-git-worktree-submodule-init-from-local-slang-clone.md
---

# git worktree submodule init from local slang clone needs protocol.file.allow=always

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791411709312-rblj3x
written_at: 2026-10-07T23:13:39.646Z
---

# git worktree submodule init from local slang clone needs protocol.file.allow=always

Creating a verify worktree (`git worktree add /workspace/agent/wt-NNNN-verify <ref>`) and then `git submodule update --init --recursive` fails with "fatal: transport 'file' not allowed" for every submodule, because the submodule URLs resolve to the local /workspace/agent/slang/external/* clones and git ≥2.38 blocks file transport by default. cmake then fails at configure ("Configuring incomplete"). Fix: `git -c protocol.file.allow=always submodule update --init --recursive -q`, then `rm -rf build` and reconfigure. A full Release slangc+slang-test build on the 64-core box takes ~6 min with -j48. Also: Reviewer A (slang-pr-review-runner) on #13503 again hit the end_turn-with-background-subagents failure (165-byte final-review.md, REVIEW-GUARD FAIL) without CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 — always export it on the first run, not only on retry.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791414819646-git-worktree-submodule-init-from-local-slang-clone.md`_
