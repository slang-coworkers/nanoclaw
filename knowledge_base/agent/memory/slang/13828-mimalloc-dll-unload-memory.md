---
type: chain
title: slang#13828 — memory retained after unloading Slang DLLs with mimalloc
description: "Triaged 10-21 23:48Z (slang-triager atznhk, P2). slang-fixer 4stbs2: DRAFT PR #13867 @2c13036b3 (pr: non-breaking, Fixes #13828), DllMain hooks set mi_option_destroy_on_exit on FreeLibrary, MSVC/clang-cl only. R1 APPROVE_WITH_NITS applied. Fix Report 10-22 16:01Z (partial: MinGW excluded). PARKED on pdeayton-nv's MinGW scope answer (cmt 6345115524) + Windows CI run 39807820023."
tags: [slang, mimalloc, windows, dll, memory]
---

# slang#13828 — memory retained after unloading Slang DLLs with mimalloc

**Fix:** each of slang-compiler.dll and slang-glslang.dll gets a `DllMain` that sets `mi_option_destroy_on_exit`, but only
on `DLL_PROCESS_DETACH` with `lpReserved == NULL`; process exit is unchanged. Gated on `_MSC_VER`. CMake sets
`SLANG_GLSLANG_USES_MIMALLOC`. The new unit test `libraryUnloadReleasesMemory` runs only on Windows. Linux mechanism
repro: +33.0 GiB VA / +1.49 GiB RSS before the fix, about 0.6 MiB after it.

**Why MinGW is excluded:** there, mimalloc registers its shutdown from an `__attribute__((constructor))` that is not
ordered before C++ static constructors. codex CODE_REVIEW keeps this as must-fix until the maintainer answers.

**10-22 16:01Z, Fix Report, routed to me.** I checked live: the PR is a draft at `2c13036b3`. Bot comment 6345115524
(15:54Z) asks pdeayton-nv whether excluding MinGW is acceptable. Run 39807820023 is a `workflow_dispatch`, with its
Windows build jobs in progress at about 16:05Z. The triager session `atznhk` had nothing after 10-21 23:49Z, so I
forwarded the Fix Report to it for the `[Triage Resolution]`.

**Parked on:** pdeayton-nv's MinGW answer, which is a maintainer call (not an operator one), and the Windows CI result
for the new test.
**10-22 16:05Z:** slang-reviewer approved the nit-check at 2c13036b38 (APPROVE, 0 bugs, 0 gaps). Still open: the Windows test `libraryUnloadReleasesMemory` must show PASSED in test-windows-release-cl-x86_64-gpu (run 39807820023, queued), and pdeayton-nv's MinGW scope answer.
**10-22 16:18Z, triage resolved (partial).** The triager edited cmt 6345115524 in place and dropped the @-mention. The original 15:54Z post had already notified pdeayton-nv. One-shot re-check `i13828-recheck` is set for 10-25 16:00Z (triager-owned).
