---
type: chain
title: slang#13982 — `-g` emits DebugSource for an imported module that contributes no code
description: "External (fuchstraumer) 10-28 17:56Z bug report, P3, reproduced. Approach A in the linker plus a CU include list; IR module version 37→38 with a v37 fallback (v38 collides with open PRs #13953/#13872/#13564/#13425). Bot DRAFT PR #13992 @4f421651e (fixer gqj7h3 owns the pr-mapping); internal R1 APPROVE_WITH_NITS applied. PARKED on operator un-draft sign-off (dashboard msg 55), then the lujinwangnv/csyonghe #7203-intent question. Re-chase rechase-slang-13982-r1-5ee9 10-30 16:00Z."
tags: [slang, spirv, debug-info, debugsource, linker, triage]
---

# slang#13982 — orphan `DebugSource` / `DebugCompilationUnit` for unused imports

**Sessions (canonical thread `gh-issue-shader-slang/slang-13982`):** Main `fck2yn`, triager
`xgwfkv`, fixer `gqj7h3`.

## Problem

With `-g2`/`-g3` (any `-O`), `import Unused;` with nothing used still emits a `DebugSource`
(full source text in an `OpString`) plus a `DebugCompilationUnit` that nothing references.
Breaks content-based SPIR-V dedup across shader permutations (reporter's use case: one small
module per permutation value, each defining a `static const`). `-separate-debug-info` does
not work around it (build-id hash and ID numbering still differ).

## Triager finding (not yet verified by me)

`linkIR` clones every user module's DebugSource/CU unconditionally
(`source/slang/slang-ir-link.cpp:2379`, `:2389`); DCE keeps them; the SPIR-V emitter writes every
one. Recommended **A**: in the linker, after cloning, keep a module's set only if the linked debug
info already references one of them (`findClonedValue`), which preserves #7203's "all files"
behavior for used modules. B (post-link prune) rejected: drops `#include`d headers with no line
entries. C (opt-in flag) is the fallback. PR should ask the #7203 owners to confirm intent.
Memo: `/workspace/inbox/a2a-1793210587327-36tu5s/triage-13982.md`.

## Timeline

- **10-28 17:56Z** `issue_opened`; live read: open, 0 comments, no assignee. Dispatched to triager.
- **10-28 18:03Z** triage comment 6476728663; labels `reproduced`, Type=Bug. Handed to fixer.
- **10-28 18:04Z** fixer claimed: worktree `wt-slang-13982`, `fix/issue-13982` @ 3218a7612.
- **10-28 20:22Z** fixer progress (their report, not verified by me): 5 commits. Linker fix, plus the CU now records which files it `#include`s. The serialized module version goes 37→38, with a legacy load path. Repro and unit test pass, and their CODE_REVIEW approved. Full slang-test was running before the draft PR. ⚠️ Watch at review whether the version bump needs `pr: breaking change` or a maintainer comment.
- **10-28 ~20:36Z** **draft PR #13992** `fix/issue-13982` @ c376bd17d, `Fixes #13982`, `pr: non-breaking`, author nv-slang-bot. I verified the pr-mapping: fixer `gqj7h3` owns it on the canonical thread. Fixer status comment on the issue: 6480106665. The fixer's reason for the version-37→38 CU include list: a lazily created DebugSource inside one module can point at another module's file, so a module's DebugSource set does not reliably tell which files belong to it. Version-37 modules keep the old behavior, which is why the PR is labeled non-breaking.
- **Next:** peer review. Then a maintainer decision (lujinwangnv, csyonghe): did #7203's "all files" mean the files of each used module? That question blocks the merge, not the triage chain. The triager forwards the `[Triage Resolution]` once the `[Fix Report]` lands.
- **10-28 20:41Z** fixer sent `[Fix Review Request]` to slang-reviewer. Repro output went from 2 DebugSource + 2 CU to 1 + 1. Full suite 11010/11013. The fixer says the 3 failures are CUDA fp8 tests that don't use `-g` and fail with a PTX JIT error. Not yet checked against master, by me or the reviewer.
- **10-28 21:39Z** reviewer `dbjhj6` R1 @ c376bd17d: **APPROVE_WITH_NITS**, 0 bugs, 1 gap. The fixer received both the review and the G1 patch (fixer rows 16/18); the reviewer CC'd me the 1240-line combined review (`/workspace/inbox/a2a-1793223557832-so7fuv/combined-review.md`). No GitHub review was posted on the draft. The suite's 3 failures (`fp8-cuda*`) fail on master too, confirmed by the reviewer.
  - **G1:** no test pins the new CU `includedSources` operands. With D2 (operands removed), 277/277 tests still pass. Tested remedy patch: `tests/spirv/debug-source-include-no-lines.slang` + 3 helpers. Results: head 3/3, D2 0/3.
  - **N1:** the Risk line in the PR description. (c) ⚠️ **Module version 38 collides with 4 open PRs: #13953 (min=max=38), #13872, #13564, #13425.** Each conflicts in `slang-ir.h`, so whichever merges second renumbers. `k_firstModuleVersionWithCompilationUnitIncludes` must follow the new number; if #13953 lands first, the v37 fallback is dead.
  - N2/N3: comment nits only. Next: fixer applies G1 + nits, then sends `[Fix Report]`; the triager forwards `[Triage Resolution]`.
- **10-28 21:59Z** `[Fix Report]` (fixed). Verified: head 4f421651e, still a draft, 15 files +421/−65, 8 test files plus `unit-test-ir-blob.cpp`. The PR body has a Risk line on the v38 collision and an open question for lujinwangnv and csyonghe that @-mentions nobody. CI at 4f42165: 30 checks skipped (draft). tests/spirv + tests/debuginfo 760/760 at head (fixer's figure).
- **PARKED on:** (A) operator sign-off to move #13992 from draft to ready (asked on orchestrator-dashboard thread `gh-issue-shader-slang/slang-13982`, msg 55, 10-28 ~22:05Z); then (B) the maintainers' #7203-intent decision. When the PR goes ready, check `paused` before routing `pr_ready_for_review` (both approvers are paused).
- **Timer:** one-shot `rechase-slang-13982-r1-5ee9`, 2026-10-30 16:00Z (task-hygiene r1 of 3).
- **10-29 13:15Z** `pr_mention` webhook. jhelferty-nv (MEMBER) commented on the issue: "@pdeayton-nv Do you want to take a look at this one?" ([6497690596](https://github.com/shader-slang/slang/issues/13982#issuecomment-6497690596); the live body matches). github-actions had auto-assigned jhelferty-nv when the PR opened (10-28 20:36Z). The comment is addressed to another human, so it is **not a bot summons**: no dispatch, no reaction, no post. #13992 is still a draft @4f421651e, with no human comments or reviews. I sent a delta to the operator on the dashboard thread and extended `rechase-slang-13982-r1-5ee9` with rows for a pdeayton-nv reply or takeover.
