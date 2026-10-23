---
type: chain
title: slang#13875 — update mimalloc v2.1.7 → v2.5.2
description: "pdeayton-nv (MEMBER) filed 10-22 17:53Z, self-labelled bot-ok. Triaged 18:06Z (P2; approach B: bump to 2406cc5f + MI_NO_OPT_ARCH + /Zc:__cplusplus on slang-mimalloc.cpp; bump before #13867). DRAFT PR #13879 @ce18ba9f9, review done; PARKED on a maintainer (priority gate on CI 39864443867 or mark ready; MI_NO_OPT_ARCH; cmake-options). Re-chase r1 2026-10-26T16:00Z."
tags: [slang, mimalloc, dependency, build, submodule]
---

# slang#13875 — update mimalloc to v2.5.2

**10-22 17:53Z `issue_opened`.** Main webhook session `sess-1792691600965-5z1r3a`. Live read ~17:56Z: open, 0
comments, label `bot-ok` (applied by the author at 17:53:20Z), assigned to pdeayton-nv by jhelferty-nv (timeline
actor) at 17:53:30Z. Body = payload. No other session on the canonical thread; no task names it.

**Why dispatched despite a maintainer assignee:** the author added `bot-ok` themself, and the operator said
`bot-ok` authorizes triage and a bot PR (dashboard 506932, 506954). That overrides the rung-4 maintainer-owned hold.

**Related chains:** [#13827](13827-mimalloc-windows-duplicate-operator-new.md) (MERGED 17:41Z, `80e4385a4`:
`MI_OVERRIDE OFF` — the fixer already modelled v2.5.2 on Linux; Windows MSVC `/MT` link with v2.5.2 untested) and
[#13828](13828-mimalloc-dll-unload-memory.md) (DRAFT PR #13867, `DllMain` + `mi_option_destroy_on_exit`; parked on
pdeayton-nv's MinGW answer). A bump changes the mimalloc that #13867 targets.

**Dispatched:** slang-triager, thread `gh-issue-shader-slang/slang-13875`, ~17:57Z.

**10-22 17:58–18:00Z, triager progress (triager's finding, not yet verified by me):** v2.5.2 = `2406cc5f`,
highest v2.x tag. In v2.5.2, Windows init moved from `init.c` `.CRT$XIU` to `prim/windows/prim.c` `.CRT$XIB` +
`atexit`; `mi_option_enable(destroy_on_exit)` still triggers teardown, so the #13867 mechanism survives the bump.
CMake option diff still running; memo + handoff + issue post to follow.

**10-22 18:06Z, triaged** (triager `dyq6ck`; memo `/workspace/inbox/a2a-1792692400027-pmnnwc/triage-13875.md`):
enhancement / low / build-deps / P2. Recommends approach B: bump gitlink to `2406cc5f` + `.gitmodules branch = v2.5.2`
(the tag is on `dev2` only), plus `MI_NO_OPT_ARCH ON` (v2.5.2 forces armv8.1 on arm64) and `/Zc:__cplusplus` on
slang-mimalloc.cpp (v2.5.2's aligned new/delete guard went `||`→`&&`, so MSVC's 199711L drops the aligned overrides).
Merge order: bump first, then #13867 rebases and rewrites its v2.1.7-specific comments. MinGW gap narrows (UCRT64
only), so pdeayton-nv's #13828 answer is still needed. **Verified by me:** tag `02d5f7ce`→`2406cc5f`; the guard
change (line 51) and MI_OPT_ARCH forced ON (CMakeLists :161-165). Bot comment 6347794896 posted 18:07:55Z.
Issue Type = Feature (set 18:08:27Z; my 18:09Z read was stale). Fixer session `dgnjiu` created 18:06Z.

**10-22 20:26Z, DRAFT PR #13879** (`fix/issue-13875` @519e1ee8f, +38/−5, `pr: non-breaking`, `Fixes #13875`; verified
live). Files: `.gitmodules`, `external/mimalloc`, `external/CMakeLists.txt`, `source/slang/CMakeLists.txt`,
`source/slang/slang-mimalloc.cpp`. Approach B, plus `/Zc:__cplusplus` on the SPIRV-Tools mimalloc.cpp too and an
`#error` guard. pr-mapping → fixer `dgnjiu`. Fixer's Linux results: pin check PASS, unit 655/655, compute +
language-feature 3282/3284 (2 CUDA flakes pass alone), arm64 configure probe 16→0 armv8.1 lines. Draft CI at 20:30Z:
4 pass, 54 skipping — **Windows MSVC/ARM64 not yet exercised**. Next: fixer peer review → Fix Report → triager
Triage Resolution. Merge order: #13879 before #13867. Avoid a full-matrix `workflow_dispatch` on the draft (#13850
starved the queue 10-22 01:35Z).

**10-22 21:04Z, R1 review** (slang-reviewer → fixer msg 9; nothing posted, not authorized): REQUEST_CHANGES, 0 bugs,
4 small gaps — L1 single-config Debug gets mimalloc's `MI_DEBUG=2` over Slang's level 1 (16 redefinition warnings);
L2 two stale `FlsAlloc` comments; L3/L4 two tested configure-time checks. Reviewer wants Windows MSVC CI + a PCH-on
build before merge. Windows CI gated on `wait-for-human-priority`. ⚠️ `cmake-options.yml` has **no inputs** (full
matrix, the #13850 478-job queue-starver), so I told the fixer: PCH-on build locally, no dispatch on the draft.

**10-22 21:45Z, R1 applied → head `08ae40446`** (verified live). L1–L3 + clarity edits in; L4 declined. Local PCH-on
Linux Debug + mimalloc builds clean, unit 655/655. Fixer correction to my note, **correct**: `ci.yml`'s `filter` job
skips `pull_request` events on drafts, so clearing `wait-for-human-priority` matters only for a dispatched run. Stale
dispatch 39848316460 (519e1ee) cancelled; new `ci.yml` dispatch **39858736648** on 08ae404 is `waiting` (the human
gate). PR body line 8: "A CMake Options dispatch before merge is a maintainer's call." R2 (final round) requested.

**10-22 22:16Z, R2 review: APPROVE_WITH_NITS**, 0 bugs, nothing posted (not authorized). R1 must-fixes verified. 3
comment-accuracy nits (N1: "mimalloc defaults to level 2 in Debug" wrong for multi-config builds). Fixer applies
N1–N3 with no further round, then Fix Report. Pre-merge, still outstanding: Windows MSVC CI (dispatch 39858736648 at the
priority gate), Windows ARM64 jobs (not required), an MSVC PCH-on build (CMake Options dispatch = maintainer's call).

**10-22 22:27Z, Triage Resolution — PARKED on a maintainer.** Final draft head `ce18ba9f9` (7 files, +91/−24; verified
live). R2 nits N1–N5 applied, N6 declined. Also `MI_DEBUG ON` in single-config Debug (keeps level 1) and a configure-time
`SOURCES` check for the `/Zc:__cplusplus` guard. CI dispatch 39858736648 cancelled; **39864443867** on ce18ba9 `waiting`
at `wait-for-human-priority`. Issue status cmt 6350528875 updated 22:27:34Z; explanation cmt 6350519363.
**Maintainer decisions:** clear the gate or mark #13879 ready (Windows MSVC `/MT` + ARM64); `MI_NO_OPT_ARCH`; a
`cmake-options.yml` dispatch; merge before #13867 (which then rebases, rewrites its v2.1.7 comments, re-runs
`libraryUnloadReleasesMemory`; its MinGW question stands).
**Resume:** webhooks (human comment, ready_for_review, merge/close) + one-shot `rechase-slang-13875-r1` at
2026-10-26T16:00Z (task-hygiene slot r1 of 3).
