---
type: chain
title: slang#13828 — memory retained after unloading Slang DLLs with mimalloc
description: "Triaged 10-21 23:48Z (slang-triager atznhk, P2). slang-fixer 4stbs2: DRAFT PR #13867 @2c13036b3 (pr: non-breaking, Fixes #13828), DllMain hooks set mi_option_destroy_on_exit on FreeLibrary, MSVC/clang-cl only. R1 APPROVE_WITH_NITS applied. Fix Report 10-22 16:01Z (partial: MinGW excluded). Windows CI gate CLEARED 10-25 (verified). PARKED only on pdeayton-nv's MinGW scope answer (cmt 6345115524); triager re-check t-cf6059 10-29T16:00Z."
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
**10-25 16:03Z, re-check (triager `[Report]`).** Gate 2 cleared. I checked the job logs myself through
`gh api --allow-escape-sequences repos/.../actions/jobs/<id>/logs`, because `gh run view --log` refuses while the run
waits on `falcor-build-approval-gate`. All 4 Windows test-slang jobs (x64 release/debug, aarch64 release/debug) print
`passed test: 'slang-unit-test-tool/libraryUnloadReleasesMemory.internal'`. Gate 1 is still open: pdeayton-nv has not
replied, and the last comment on the issue is still the bot's 6345115524 (PATCHed in place 16:02Z, so no new
notification). #13879 (mimalloc v2.5.2) is open and not a draft. If it merges first, #13867 needs master merged in
(merge, not rebase) and the unload test re-run. The triager's next one-shot is `t-cf6059` at 10-29T16:00Z; I did not
verify it, because it is a peer task. The dashboard was already told about the park on 10-22, so nothing new went there.

**10-26 ~23:31Z, base moved.** #13879 (#13875) merged at 23:26Z (`f80573815`), so master now has mimalloc v2.5.2, and
#13867 (still draft @2c13036b3, no reviews) is `DIRTY`. The MinGW question (cmt 6345115524) is still unanswered.
I dispatched fixer `4stbs2`, pinned on this thread, to:
- merge `origin/master` (no rebase or force-push);
- rewrite the v2.1.7 comments (`.CRT$XIU`/`init.c` → `.CRT$XIB` in `src/prim/windows/prim.c`) and re-verify both premises on v2.5.2;
- note that v2.5.2 uses the MSVC path for MinGW only under UCRT64, and keep MinGW excluded with no re-ping;
- dispatch `ci.yml` once for `libraryUnloadReleasesMemory` (no cmake-options) and stay draft;
- send the Fix Report to the triager.
**10-27 12:41Z:** #13867 is updated for mimalloc v2.5.2 at `c52a7a1` (merge plus comment rewrite; the hook is unchanged and both premises were re-checked in the v2.5.2 source). Windows CI 39807820023 at 2c13036 (v2.1.7) had shown `libraryUnloadReleasesMemory` PASSING in all 4 Windows test-slang jobs. The dispatch 40504205087 at c52a7a1 yielded and will not auto-retry, because of the retry deadlock. MinGW is still excluded; pdeayton-nv hasn't answered.
**10-27 12:51Z:** the triager refreshed cmt 6345115524 (no @-mention) and checked both premises against v2.5.2 itself. It corrected my wording: on a priority-yielded run, approving `falcor-build-approval-gate` alone runs nothing, because the 40 other jobs were already skipped. A maintainer must mark the PR ready, or start CI (approve plus `gh run rerun --failed`). Re-check `t-cf6059` on 10-29.
