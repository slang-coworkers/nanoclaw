---
type: chain
title: slang#14447 — NVRTC compile fails when CUDA_PATH is set but CUDA bin\x64 is not on PATH
description: Maintainer (jkwak-work) filed 11-10 19:46Z, assigned to the author by jhelferty-nv 11 s later. Windows NVRTC loader issue found via PR #14419. HELD rung 4: no dispatch, no post.
tags: [nvrtc, cuda, windows, dll-loading, downstream-compiler, maintainer-owned, held]
---

# slang#14447 — NVRTC builtins DLL not found when only CUDA_PATH is set

**11-10 19:46:25Z, `issue_opened`.** Live read (11-10): OPEN, author **jkwak-work** (MEMBER), assigned to
jkwak-work by **jhelferty-nv** at 19:46:36Z, 0 labels, 0 comments, body 3032 B (matches payload). Timeline:
only the assign event, no linked PR or commit. No memory hits for 14447 or 14419; no chain of ours owns it.

**Report.** `_findNVRTC` (`source/compiler-core/slang-nvrtc-compiler.cpp`) finds `nvrtc64_130_0.dll` under
`CUDA_PATH\bin\x64`; `SharedLibrary::loadWithPlatformPath` (`source/core/slang-platform.cpp`) loads it by full
path with `LOAD_LIBRARY_SEARCH_DEFAULT_DIRS`; then NVRTC's own `LoadLibrary("nvrtc-builtins64_132.dll")` searches
app dir / System32 / cwd / PATH, not the NVRTC directory, so every NVRTC compile fails (exit 255). Author's
untested fix options: (1) pre-load `nvrtc-builtins64_*.dll` from the NVRTC directory, (2) `SetDllDirectory`,
(3) clear error. Impact: `-validate-with-downstream-compiler` (PR #14419) and the planned default CUDA `SIMPLE`
validation in slang-test.

**Disposition: held, nothing dispatched or posted.** Same class as [#14424](14424-cuda-perf-regression-forceunroll-13781.md)
/ [#14429](14429-reflection-generic-params-constraints.md): maintainer-written diagnosis with its own fix
direction, assigned to its author by a peer maintainer (rung 4). Windows-only, so not reproducible on this Linux
fleet anyway. **Resume** only on an @nv-slang-bot mention, an operator ask, or the issue being unassigned.
Mentions arrive as webhooks, so no timer.

**11-10 23:13Z — fix PR #14449 by the author** (jkwak-work, branch `cuda-13-search-path`, `Fixes #14447`): option (1),
pre-load `nvrtc-builtins64_*.dll` from the NVRTC directory; 1 file `slang-nvrtc-compiler.cpp` +49/-0, head `25fa828b`.
Its `pr_ready_for_review` (opened) was **not forwarded**: slang-pr-approver is paused; queued in
`data/approver-pause-queue.md`. Chain stays held (human PR, no bot action).
