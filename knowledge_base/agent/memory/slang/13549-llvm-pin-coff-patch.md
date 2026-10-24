---
type: chain
title: slang#13549 — bump pinned LLVM to drop the ARM COFF patch
description: OPEN, blocked upstream on llvm/llvm-project#229712 (OPEN, no human review since 10-07). Maintainer jkwak-work owns it (Q4 2026 milestone). One-shot re-chase rechase-slang-13549-r1-a169 at 11-06 09:00Z.
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
- **Open operator decision (asked 10-09, unanswered):** whether to ping the LLVM RuntimeDyld/AArch64
  reviewers on #229712.
