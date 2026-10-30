---
type: chain
title: slang#14033 — `-target cuh` emits only the prelude include; no entry-point prototypes/param types for host code
description: Human-filed (albertrodriguezclo) feature request 2026-10-29 17:10:15Z, second cloth-sim batch (#14032–#14038). Routed to slang-triager under the R6 hold (no bot comment before 2026-11-02T17:10:15Z). Related to #14028 (ask 4 absolute prelude path; `_0` names).
tags: [cuda, cuh, host-interop, feature-request, r6]
---

# slang#14033 — usable `-target cuh` header for host `.cu` launches

**Ask.** `-target cuh` should emit, host-includable and without the device-only prelude: the struct
types used by entry-point parameters, one `extern "C" __global__` prototype per entry point, and
ideally the `[numthreads]` values as constants / a launch helper. Today it writes only
`#pragma once` + an **absolute** `#include ".../prelude/slang-cuda-prelude.h"`.

**Overlap with #14028** ([record](../imported/project_14028_extern_cpp_host_header_math.md)): the
absolute prelude path is #14028 ask 4 (slangc-CLI-only gap, parked on maintainer direction); `_0`
field names are #14028 ask 1 (slang-fixer `sess-1793291431051-8575nm` owns asks 1+2 in one PR).

**Routing (10-29 17:1xZ).** Live check: open, 0 comments, no labels, no prior triager session.
Dispatched to slang-triager on `gh-issue-shader-slang/slang-14033` with the **R6 hold**: no fenced
crash/ICE (fences present, no crash word), no `bot-ok` → no bot comment before
**2026-11-02T17:10:15Z**; triage memo returns to Main only.

**Triage (slang-triager, 17:41Z; memo `/workspace/inbox/a2a-1793295697038-z1jgb9/triage-14033.md`).**
Reproduced on 9b3ac25. **Not a regression**: cuh (PR #3938, experimental) is opt-in, exporting only
`__extern_cpp`/`[CudaKernel]`/`[DllExport]`. **Sub-bug A (P2, fixer-ready):** an `__extern_cpp`
`[shader]` entry still gets no cuh prototype. Two causes: the entry-point guard at
`slang-emit-c-like.cpp:4126`, and CUDA varying legalization not calling `fixUpFuncType` (the IR
keeps 4 params vs 3 in `.cu`, so an ABI mismatch if only the guard is lifted). Fix A1 was approved
by codex at R3. B (declare by default), C (g++-includable), D (`[numthreads]`) are parked for
jkwak-work/csyonghe (+pdeayton-nv hpp precedent). The workaround `[CudaKernel]` + `__extern_cpp`
was verified with an nvcc link/run on the L40S. Labels recommended, not applied: `reproduced`,
Type=Feature.

**Main decision (17:4xZ): hold A until R6 elapses.** Reason: this reporter often opens their own
fix PR (#13903, #13945 and others), and a bot PR would cross-reference the issue during the hold.
Live check: timeline empty, no reporter PR for cuh. The triager's one-shot **t-11a7cd
(2026-11-02 18:00Z)** checks first for a reporter PR or maintainer comment. If there is none, it
posts the 5-bullet + labels and hands A to slang-fixer. The `[CudaKernel]` `_0,_1` param-name note
goes to the #14028 fixer via the triager, with no #14033 reference before the R6 date.
**17:46Z.** Triager confirmed: `t-11a7cd` prompt now holds the standing order, and no GitHub writes
were made. Main verified that the #14028 FYI landed in fixer `sess-1793291431051-8575nm` (inbound
17:45:44Z, fixer replied 17:45:59Z) and that no extra session was minted. Next touch: t-11a7cd
report, 11-02 18:00Z.
