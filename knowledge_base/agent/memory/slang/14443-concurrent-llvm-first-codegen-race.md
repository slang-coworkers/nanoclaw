---
type: chain
title: slang#14443 — concurrent first getEntryPointCode() on LLVM targets crashes/hangs (getOrLoadSlangLLVM + llvm::cl parsing races)
description: Bot-filed (slang-triager) 2026-11-10 16:58Z as side-finding H2 of #14441. Owned by the #14441 triager chain, so do NOT dispatch its issue_opened webhook. Main decision 17:0xZ: the #14441 triager hands it to slang-fixer on gh-issue-shader-slang/slang-14443.
tags: [threading, llvm, parallel-backend, race, tsan, split-out]
---

# slang#14443: LLVM target first-compile race

⚠️ **Its `issue_opened` webhook belongs to the [#14441 chain](14441-async-target-codegen-prepared-job.md), so do not dispatch it.**
Filed by nv-slang-bot through slang-triager, labelled `reproduced`, Type=Bug, no assignees.

**Repro** (master `4f66408b`, harness kept in the triager's `/workspace/agent/scratch-14441/`): 8 threads each make
their first `getEntryPointCode()` on SLANG_SHADER_LLVM_IR at the same time. 13 of 60 release runs failed:
8 hangs, 3 segfaults, 2 aborts with `LLVM ERROR: inconsistency in registered CommandLine options`. Controls
were clean: 1 thread, and one serial warm-up compile. TSan shows (a) `getOrLoadSlangLLVM` read
`slang-global-session.cpp:1292` against write `:1295`, and (b) per-builder `llvm::cl::ParseCommandLineOptions`
at `slang-llvm-builder.cpp:523`.

**Routing.** The fix is small, does not depend on which #14441 scope is chosen, and is in the documented
contract, so the fixer is started: the triager hands it to slang-fixer on `gh-issue-shader-slang/slang-14443`.
- 11-10 17:05Z — triager (msg 26): handed off to slang-fixer (worktree `wt-slang-14443`, branch `fix/issue-14443`). Approach A, libslang-only: a mutex in `getOrLoadSlangLLVM` plus a process-wide static mutex around `createLLVMBuilder_V3`. Status comment 6773783693 verified. The triager waits for the [Fix Report], then sends [Triage Resolution].
- 11-10 18:33Z — triager (msg 28): **draft PR #14446** (head `9f9254b`, `pr: non-breaking`). It adds a per-session lock around the slang-llvm load and one process-wide lock around `createLLVMBuilder_V3` and `getLLVMTargetBuiltinTypeLayoutInfo_V2`. Repro: master 9/60 failed, fix 0/260; TSan 0 in 6 runs. slang-test 12039/12042 (3 fp8-cuda failures also on master). Peer review is running. When done it goes on the weekly ready-flip list (not P0/P1).
- 11-10 20:19Z — **[Triage Resolution]** (triager msg 30): #14446 head `5952662ce` (verified: draft, body has `Fixes #14443`). slang-reviewer APPROVE_WITH_NITS (0 bugs), nits applied. Acceptance met: repro 0/320, TSan 0 in 6 runs, unit test `parallelFirstLLVMCodegen` (master 8/60, head 0/60). Revert drill done. **RESTING** on maintainer review; added to the 11-16 weekly ready-flip list. Proposed follow-ups (not filed): call_once inside slang-llvm, the `_initLLVM` C++-downstream path, per-TargetRequest layout-info cache.
