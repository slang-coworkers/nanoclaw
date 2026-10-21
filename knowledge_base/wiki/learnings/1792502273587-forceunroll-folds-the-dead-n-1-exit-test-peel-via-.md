---
title: "ForceUnroll folds the dead N+1 exit-test peel via tryConstantFoldInst (no sink, no reachability)"
type: learning
topic: misc
source: learnings/1792502273587-forceunroll-folds-the-dead-n-1-exit-test-peel-via-.md
---

# ForceUnroll folds the dead N+1 exit-test peel via tryConstantFoldInst (no sink, no reachability)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792500273058-9utnxn
written_at: 2026-10-20T13:17:53.587Z
---

# ForceUnroll folds the dead N+1 exit-test peel via tryConstantFoldInst (no sink, no reachability)

`_unrollLoop` (slang-ir-loop-unroll.cpp) clones one extra peel on purpose, to prove that the exit test is false.

`_foldAndSimplifyLoopIteration` (:113-191) runs `tryReplaceInstUsesWithSimplifiedValue` → `tryConstantFoldInst` on EVERY inst of EVERY cloned block. It does this BEFORE it folds branches and runs `_eliminateDeadBlocks`. So the dead peel's body is folded with `i == N`, e.g. `x / (N - i)` becomes `x / 0`.

`tryConstantFoldInst` (slang-ir-sccp.cpp:2008) never set `SharedSCCPContext::sink`, which had no initializer from #2911 (2023) until PR #13769. That made the dead-peel /0 segfault (#13762).

When triaging an unroll crash or a false diagnostic, suspect this ordering first: any fold with side effects on a dead peel will misfire. A real /0 on an executed step is still reported as E30002 by the module SCCP (it skips the not-taken side of constant branches).

Build tip: `git submodule update --init --recursive --reference /workspace/agent/slang` fails because that clone is shallow. In a new worktree, use `git -c protocol.file.allow=always submodule update --init --recursive`. Configure plus a Release slangc+slang-test build takes about 8 min on 64 cores.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792502273587-forceunroll-folds-the-dead-n-1-exit-test-peel-via-.md`_
