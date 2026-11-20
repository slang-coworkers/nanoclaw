---
type: project
title: "slang#14632 — Linux: NVRTC lookup only tries unversioned libnvrtc.so (runtime-only CUDA installs fail)"
description: Human-filed NVRTC soname-lookup bug; triaged 11-19, fixer chain live; reporter has a validated fork-branch fix (no PR, CLA pending)
---

# slang#14632 — NVRTC not found when only CUDA runtime packages are installed

HUMAN-filed 11-19 09:26Z by **0z5a** (external contributor; 👀 id 669796512). R6 dispatch
→ slang-triager 09:27Z (sess-1795080478935-4ryfes, canonical thread
`gh-issue-shader-slang/slang-14632`). Live at dispatch: open, 0 comments, no labels, no assignees.

## Triage (09:32Z, triager report + GitHub cmt 09:32:56Z)

bug / medium / P2 / target-emit (CUDA/PTX downstream loading) · not a regression (never worked on
Linux) · not a dup. Root cause: `NVRTCDownstreamCompilerUtil::locateCompilers()`
(source/compiler-core/slang-nvrtc-compiler.cpp:1690-1706) tries only `loadSharedLibrary("nvrtc")`
→ Linux `libnvrtc.so` (dev-package-only); the `_findAndLoadNVRTC()` fallback is Windows-guarded —
non-Windows `#else` returns E_NOT_FOUND immediately. Runtime-only installs (nvidia/cuda
*-runtime images, `cuda-nvrtc-*`, Ubuntu `libnvrtc12`, pip wheels) ship only `libnvrtc.so.12/.13/.11.2`
→ `-target ptx` fails despite working NVRTC. `-nvrtc-path libnvrtc.so.N` = workaround.
`reproduced` NOT applied (no docker locally; mechanism verified: `-nvrtc-path libnvrtc.so.12`
loads, exit 0). Issue Type set to Bug.

Recommended fix = reporter's Approach A: versioned-soname fallback loop newest-first
(`libnvrtc.so.13/.12/.11.2`) in the non-Windows `#else`, ~10 lines, no core changes (loader passes
".so." names through, triager verified locally) + matching docs/cuda-target.md line.
Alternative B (Linux directory-scan discovery) rejected as disproportionate (~100+ lines).
Full triage memo: [raw/triage-14632.md](raw/triage-14632.md). Triage 5-bullet comment id 7005231268.

## Chain state

**Fixer LIVE** — slang-fixer sess-1795080763053-o2m98c on the canonical thread since 09:32Z.
Triage comment posted (nv-slang-bot, 09:32:56Z): "Triaged → handed to the fix team; a draft PR is
expected shortly" + verdict. My own main-group session sess-1795080379297-hblhhe drives the chain
(verified: it holds webhook seq 2, dispatch seq 3, triage report seq 4, memo seq 6 — NOT a phantom).

## WATCH

- **Reporter's own fix**: 0z5a has the candidate on fork branch 0z5a/slang@a29bcef (validated in 7
  environments per the issue body) and said they'll open a PR once the CLA is signed, pending
  direction confirmation. If they open their own PR → human self-fix → stand our draft down
  (#14557 precedent) and shepherd instead.
- Approach A should credit the reporter's analysis; if our fixer lands first, the PR body should
  acknowledge 0z5a's fork commit as the source of the approach.
- No-NVRTC-installed diagnostics note: fix adds ~3 extra "failed to load dynamic library" notes
  in the nothing-installed case — acceptable per triage, but don't regress the error UX further.

Related: #14447 (NVRTC nvrtc-builtins DLL load, Windows cousin), #14557 (NVRTC OptiX headers).

## 2026-11-19 13:20Z — WATCH fired: reporter's PR won, no duplicate opened; test contributed

The reporter (0z5a) opened **PR #14633** mid-flight (open, non-draft, head `a29bcef0b…`, verified
live) with the byte-identical fix. Per the triager's coordination instruction AND the #14557
precedent (same-day learning: check for a maintainer's own PR before opening ours), the fixer
opened **NO duplicate PR** — instead:
- Fix + hermetic unit test were implemented and fully verified on our side (repro FAIL pre-fix →
  PASS post-fix; tests/downstream* 10/10; real-NVRTC slangc `-target ptx` controls pass).
- **Test contributed to the reporter's PR**: comment
  [7009708159](https://github.com/shader-slang/slang/pull/14633#issuecomment-7009708159)
  (nv-slang-bot 12:54:30Z, verified) + branch `nvrtc-soname-lookup-test` pushed
  (`e4c939b1b921`, verified) for easy cherry-pick.
- Issue status note posted: cmt [7009723158](https://github.com/shader-slang/slang/issues/14632#issuecomment-7009723158)
  (12:55:08Z, verified).
- Peer review ([Fix Review Request], patch mode) dispatched to slang-reviewer 12:58Z — verdict ETA
  13:20–13:30Z, then [Fix Report]. On APPROVE* → [Fix Report]; on REQUEST_CHANGES → apply,
  re-verify, re-dispatch (2 rounds max). If 0z5a takes the test into #14633, normal maintainer
  review proceeds there.

**State: shepherd mode** — the fix ships via the reporter's PR #14633; our deliverable is the test
+ the review verdict. Supervisor nudge that prompted the status had raced the fixer's own completion
(builds done 10:35/10:52/11:03; silences were codex rounds + build, no messages) — resolved, not
blocked. Resume on: reviewer verdict → [Fix Report].

## 15:27Z — TERMINAL [Fix Report] (Main-verified artifacts)

Reviewer verdict: **APPROVE_WITH_NITS** (patch mode; Reviewer A 0 bugs + 1 gap + 3 clarity,
Reviewer C 5 clarity, Devin skipped per patch mode) — **all nits applied** (explicit-path
failure-exclusivity block added, API name corrected, golden-list coupling stated, comments
tightened) and re-verified; no second round per the verdict rule. Our branch contribution is now
**+226/−4 in 3 files** (slang-nvrtc-compiler.cpp #elif SLANG_LINUX_FAMILY soname fallback mirrors
what the reporter's PR carries; docs/cuda-target.md wording; NEW hermetic fake-loader unit test
tools/slang-unit-test/unit-test-nvrtc-soname-lookup.cpp), head **`2998d89fc`** on
`nvrtc-soname-lookup-test` (Main-verified) + nits-applied follow-up cmt
[7013595276](https://github.com/shader-slang/slang/pull/14633#issuecomment-7013595276)
(15:27:49Z, verified). Tests: repro FAIL→PASS (5 scenarios), downstream* 10/10, real-NVRTC
`-target ptx` and `-nvrtc-path libnvrtc.so.12` controls both emit PTX (CUDA 12.6 box).

**Human action remaining:** the reporter/maintainer cherry-picks the test into PR #14633 —
`git fetch upstream nvrtc-soname-lookup-test && git cherry-pick FETCH_HEAD` — **take the branch
head, NOT the inline patch in the original PR comment** (that predates the review round). Then
normal maintainer review of PR #14633 (still open/unmerged at reporter head `a29bcef0b`, verified).
Issue status note 7009723158 already posted. **Chain CLOSED on the bot side; webhook-driven on
PR #14633's review activity.**
