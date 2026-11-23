---
type: chain
title: slang#13549 — bump pinned LLVM to drop the ARM COFF patch
description: OPEN, blocked upstream. llvm/llvm-project#229712 MERGED to main 10-26 (811ba37d61f4), but no LLVM release tag has it yet (re-verified 11-20 on jhelferty-nv's ask — not 23.1.6, release/23.x head f51e6963, no 24.x line) and no 23.x backport has been requested. Maintainer jkwak-work owns it (Q4 2026). Next one-shot re-chase rechase-slang-13549-r3-fda3 at 12-04 09:00Z (ordinal 3 of 3 — the cap; if it also comes up empty, the series is exhausted).
tags: [slang, dependencies, llvm, parked-upstream]
---

# slang#13549 — bump pinned LLVM to drop the ARM COFF patch

Filed 2026-10-09 by tangent-vector. PR #13139 added `external/llvm-coff-pageoffset12l.patch`, a
backport of llvm/llvm-project#229712, and the issue asks us to bump the pin and delete that patch.

- **Triage (10-09, slang-triager, cmt 6088751789):** the pin is `llvmorg-21.1.2` in
  `external/build-llvm.sh:57` / `.ps1:58`. The patch is applied at `build-llvm.sh:114-117` /
  `.ps1:111-115` and has a `.gitattributes:7-8` entry. `docs/building.md:435` also names
  21.1. The CI cache keys hash `external/llvm-*.patch`, so deleting the patch rekeys them on its
  own. No fixer was dispatched: there is nothing to bump to yet.
- **Caveats for the eventual bump:** draft #11017 (to 22.x) cannot close this, because 22.x lacks
  the fix. Going to 23.x trips `static_assert(LLVM_VERSION_MAJOR < 23)` at
  `slang-llvm-jit-shared-library.cpp:27` (#12293).
- **Maintainer comments:** jkwak-work wrote on 10-09 "marking blocked" (the repo has no `blocked`
  label, so nothing was applied), took the assignment and set the Q4 2026 milestone. On 10-23
  they wrote "still not merged yet". Both are acks; nothing was posted in reply.
- **Timer:** the 10-09 daily gated watch `rechase-13549-llvm-22971-1d4f` broke R10 (it was a
  per-issue recurrence). It was cancelled on 10-23 and replaced by the one-shot
  `rechase-slang-13549-r1-a169` (11-06 09:00Z, task-hygiene ordinal r1 of 3).
- **10-26 upstream merge:** #229712 merged to LLVM `main` as `811ba37d61f4`. On 10-28 jkwak-work
  @-mentioned the bot asking which release has it. Triager cmt 6471549909 (10-28) answered: none.
  It is not in `llvmorg-23.1.4` or the `release/23.x` head, and `24-init` predates it. No `/cherry-pick` or
  milestone has been requested; the comment gives LLVM's backport steps. Requesting the backport is the
  maintainers' decision, and we do not act on llvm-project. The r1 re-chase prompt was retargeted to
  look for a tag containing 811ba37 or a cherry-pick.
- **Tooling:** `gh api` REST to llvm/llvm-project returns 401 in this fleet (the token is scoped to
  shader-slang). GraphQL (`gh pr view`), `git ls-remote`, and treeless clones work.
- **Operator decision about pinging LLVM reviewers (asked 10-09):** moot now that it has merged.
- **r1 re-chase (11-06):** still no release has the fix. `llvmorg-23.1.5` is new (23.1.0–23.1.5 all
  lack `read32AArch64LdrAddend`), the `release/23.x` head `2875c607` lacks it, and no `llvmorg-24.*`
  tags exist. #229712 still has no milestone or labels. #13549 has had no human comment since 10-28,
  so nothing was posted. Next: one-shot `rechase-slang-13549-r2-8b4e` (11-20 09:00Z, ordinal 2 of 3),
  which also routes any new human comment. `/workspace/extra/ephemeral` is read-only, so the
  blobless probe clone goes under `/tmp`.
- **11-20 maintainer re-check ask:** jhelferty-nv @-mentioned the bot (cmt 7044592811, 16:19Z) asking
  "check again if it's in a published LLVM release". Triager re-checked live and answered cmt
  7044677779 (16:23Z): still no — newest tag `llvmorg-23.1.6` lacks it, `release/23.x` head
  `f51e6963` unchanged and lacks it, no `llvmorg-24.*` tags / `release/24.x` branch, no open
  backport PR (`gh search prs` works for llvm via GraphQL). Fix is on `main` only; first ships with
  the LLVM 24 line unless maintainers request a `/cherry-pick` to `release/23.x`. Chain memory
  `issues/13549.md` also updated on the triager side. r3 prompt retargeted to route only comments
  after 2026-11-20T16:23Z.
- **r2 re-chase (11-20):** still no release has the fix. `llvmorg-23.1.6` is new but lacks
  `read32AArch64LdrAddend` (raw-blob probe of the RuntimeDyldCOFFAArch64.h file, 393 lines — fetch
  verified non-404); the `release/23.x` head moved to `f51e6963` and still lacks it; no
  `llvmorg-24.*` tags. #13549 had no new comments (updatedAt still 10-28T14:22:59Z, jkwak-work
  assigned, labels `dependencies`). Nothing posted (case (a)). task-hygiene allowed ordinal 3 of 3;
  scheduled `rechase-slang-13549-r3-fda3` for 12-04 09:00Z. Note: task-hygiene.py lives at
  `worktrees/nc-gate/container/skills/supervise-issues/scripts/`, not `tools/`.
