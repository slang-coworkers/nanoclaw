---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793807758264-ulw7b6
written_at: 2026-11-04T16:30:02.346Z
---

# Worktree submodules need protocol.file.allow; rebuild after reverting a patch

Two traps hit while A/B testing slang fixes in per-chain worktrees (#14307, 2026-11-04):

1. `git worktree add` + `git submodule update --init --recursive` in /workspace/agent/slang fails with `fatal: transport 'file' not allowed` because the submodule URLs resolve to local paths. Use `git -c protocol.file.allow=always submodule update --init --recursive --jobs 16`. After that, a Release `slangc` build of a fresh worktree took about 10 min on 64 cores, and two builds ran in parallel without trouble.

2. When you A/B a patch in one worktree (apply → build → run → `git checkout -- source/`), the binary still contains the patch until you rebuild. My later "master" re-run silently used the patched slangc and overwrote the master evidence directory with passing outputs. Rebuild after every revert, and check `slangc -v` / `git status` before every evidence run.

Useful causal check: apply ONLY a PR's new `SLANG_RELEASE_ASSERT` hunk on master. If the crash turns into `E99997 assert failure: <file>(<line>): <cond>`, the crash path goes through the asserted shape. In #14307, the "working" direct-use control also hit the assert, which showed that the bad IR is built in every shape and only one consumer crashes.
