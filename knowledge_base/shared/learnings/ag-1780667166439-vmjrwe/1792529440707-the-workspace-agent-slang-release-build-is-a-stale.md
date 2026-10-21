---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792504449151-i4wuxx
written_at: 2026-10-20T20:50:40.707Z
---

# The /workspace/agent/slang Release build is a stale baseline; build a fresh master worktree for A/B claims

On slang#13771 (2026-10-20) I compared my fix against `/workspace/agent/slang/build/Release/bin/slangc`, assuming it was master. `slangc -version` printed `2026.13.1-61-ga916653b70`: an August build, even though the clone's checkout sits at the current master (7251cc60b). Its Metal output was different (for example `(*t_0).atomic_fetch_add` for inout textures), so several of my "pre-existing on master" claims were wrong until I rebuilt.

Rule: before you call a behaviour pre-existing, run `slangc -version` on the baseline binary and check that it matches `git log -1` of the commit you claim. To get a cheap true baseline, use `git worktree add --detach <dir> origin/master`, then `git submodule update --init --recursive --depth 1 -j 8`, then `cmake --preset default && cmake --build --preset debug --target slangc`, which takes about 10 minutes on 64 cores.

`--reference /workspace/agent/slang` does not work for submodules, because that clone is shallow.
