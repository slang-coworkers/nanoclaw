---
type: project
name: project-13890-aarch64-slangpy-cuda-pinned-host-oom
description: "slang#13890→RE-FILED as #13891 (#13890 deleted, HTTP 410). (jkwak-work, 10-23, CI Stability, assigned jkwak by jhelferty-nv): nightly GitLab test-slangpy-linux-aarch64 CUDA_ERROR_OUT_OF_MEMORY from cuMemAllocHost (slang-rhi cuda-heap.cpp:395) in test_load_texture_from_bitmap r8_sint/r8_snorm. DELETED 15:31Z, re-filed as #13891; triaged 15:42Z: root cause = slang-rhi CUDA heap teardown leak, fixed by slang-rhi PR 923 (57018e3), slangpy pin d825f483 lacks it."
---

# slang#13890 — aarch64 slangpy CUDA pinned-host OOM

**Filed** 2026-10-23 15:25Z by jkwak-work (human maintainer), label `CI Stability`; assigned to the
author by jhelferty-nv 11 s later. Live read at routing: OPEN, 0 comments, body 3349 chars.

**Signature:** `cuMemAllocHost` → `CUDA_ERROR_OUT_OF_MEMORY` at
`external/slang-rhi/src/cuda/cuda-heap.cpp:395` inside `uploadTextureData`, plus `NvMapMemAllocInternalTagged ... error 12`
(Tegra NvMap allocator). Serial pytest run (no `-n`), so the #8497 worker-count mitigation does not apply.
Passed 10-13..10-22; the 10-09..10-12 failures were segfaults (different).

**Routing (2026-10-23):** human-filed report with an open root-cause question, not a maintainer plan with its own
PR → follows the #13505 precedent ([[project_13505_slangpy_tests_cross_repo_flake_aggregate]]): `slang-triager`
on `gh-issue-shader-slang/slang-13890`, read-only analysis of the slang-rhi CUDA heap (body step 3), dedup vs
#8497/#9683/#13505, post the 5-bullet, **open no PR** (assignee owns it). R6 (#13596) 4-day defer is not applied
by hand (gate unmerged, nanoclaw #1993 draft). Related prior art: [[project_slangpy_1040_ci_gpu_oom_peak_vram]].

**Re-file (2026-10-23 15:31:51Z):** jkwak-work deleted #13890 (HTTP 410) and re-filed it as
**#13891**: same title, body 3167 chars (vs 3349), `CI Stability`, assigned to the author by jhelferty-nv at 15:32:03Z.
The #13891 webhook Main (`sess-1792769513130-eispow`) redirected the triager session that was already running
(`sess-1792769290004-x74vw2`, thread `gh-issue-shader-slang/slang-13890`) with `target_session_id`, so no second
triager session was opened. The triager posts on #13891 only. **Pin every later #13891 forward to that triager session**:
a send on thread `...-13891` would open a duplicate.

**15:31Z jkwak deleted #13890 (HTTP 410) and re-filed it as #13891** (revised body, GitLab links removed). Sibling
Main session `sess-1792769513130-eispow` owns #13891 and redirected the triager (15:33Z). The triager session stays
on the `-13890` thread, so its report came to THIS session (row from slang-triager 15:44Z), not the sibling.

**Triage (posted on #13891, comment 6368737048, 15:42Z):** slang-rhi `HeapImpl::~HeapImpl` (cuda-heap.cpp:306-310 at
d825f483) frees only the page cache; resident pages are deleted without `cuMemFreeHost`. slangpy's cached test devices
keep the primary context alive, so each uncached device that uploads strands a 256 MiB pinned page. Fixed by
slang-rhi PR 923 "Release resident CUDA heap pages during teardown" (merged 2026-10-22, 57018e3); slangpy main pins
d825f483, 16 commits behind (Main-verified via gh compare). Not r8-specific, not a duplicate. Triager reproduced the
256 MiB/cycle RSS growth on x86 L40S. Next action is jkwak's: bump slangpy external/slang-rhi. Triager armed one-shot
re-check `t-f90f20` for 10-27. No PR (assignee-owned).

RESUME: a jkwak reply / "please make a PR" (webhook on #13891); triager re-check 10-27.
