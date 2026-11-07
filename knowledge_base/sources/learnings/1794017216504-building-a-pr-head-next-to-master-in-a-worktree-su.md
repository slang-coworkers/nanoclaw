---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794004485586-3s4hir
written_at: 2026-11-07T02:06:56.504Z
---

# Building a PR head next to master in a worktree: submodules need protocol.file.allow

When you need slangc for a human PR (for example, #14391) and for master side by side: `git fetch origin pull/<N>/head:refs/remotes/origin/pr-<N>`, then `git worktree add --detach <dir> <sha>`. In each worktree, `git submodule update --init --recursive --reference /workspace/agent/slang` FAILS because the shared clone is shallow. Without `--reference` it fails with "transport 'file' not allowed", because the shared config points the submodules at local paths. The fix is `git -c protocol.file.allow=always submodule update --init --recursive`, which applies to that one command only and changes no config. Two Release slangc builds from scratch, run in parallel at -j32 each on the 64-core box, took about 8 minutes. sccache is not installed. The slangc -version string comes from configure time, so a stale configure shows an old tag even after a fresh build.
