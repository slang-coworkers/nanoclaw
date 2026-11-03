---
type: chain
title: slang#14135 — CUDA `__launch_bounds__` / per-kernel register cap attribute
description: Human-filed (albertrodriguezclo) feature request 2026-11-01 14:29:21Z, cloth-sim batch. Triaged feature/medium/P2 by slang-triager 11-01 14:39Z; parked for maintainer direction under the R6 hold (to 2026-11-05 14:29:21Z); re-check t-422839 11-05 14:35Z. No fixer chain without operator go-ahead.
tags: [cuda, emit, attributes, feature-request, r6, parked]
resource: raw/triage-14135.md
---

# slang#14135 — CUDA launch bounds / register cap

**Ask.** An opt-in entry-point attribute for the CUDA target: `[CudaLaunchBounds(256, 8)]` →
`__launch_bounds__(256, 8)`, and `[CudaMaxRegisters(64)]` → `__maxnreg__(64)` (CUDA 12.4+). Ignored or
warned on other targets. A variant derives `maxThreadsPerBlock` from `[numthreads]`. Motivation: a
cooperative CG kernel compiles to 86–88 registers instead of 58–60, so 5 instead of 8 resident blocks
per SM; the only workaround is TU-wide `nvcc --maxrregcount`, which is not available when Slang drives NVRTC.

**Related.** #14029 (CUDA grid-wide sync / cooperative launch) is the same cooperative kernel use case.

**Dispatch (11-01, Orchestrator).** Memory grep on 14135 found no hits; there was no existing triager
session, and there are no dup issues for `launch_bounds` or `maxnreg`. Labels: none. The issue has
fences but no crash word, so the **R6 hold applies until 2026-11-05T14:29:21Z**: no comment, no PR, and
no commit naming the issue. The triager works locally and sets its own one-shot for the hold end.
Thread `gh-issue-shader-slang/slang-14135`. The issue is a feature request, so a fixer handoff needs
the operator's go-ahead.

**Triage (slang-triager, 11-01 14:39Z, master 6815ed82d). These are the triager's findings; I did not reproduce them.**
Memo: [raw/triage-14135.md](raw/triage-14135.md). Feature / medium / P2, CUDA emit + frontend attributes, no duplicates.
- Reproduced: no qualifier is emitted, and the proposed attributes give E31000 unknown attribute.
- Measured on L40S, CUDA 12.6: hand-added qualifiers take a kernel from 80 to 64 registers and appear in the PTX (`.maxntid/.minnctapersm/.maxnreg`).
- `-Xnvrtc --maxrregcount` has no effect on Slang's PTX output (it applies to SASS only), so there is really no NVRTC workaround.
- `__launch_bounds__` + `__maxnreg__` on one kernel is a hard nvcc error. The issue's example stacks both, so Slang must diagnose it.
- `(256, 8)` is out of range on sm_89; ptxas warns and ignores it. The reporter's real case, (128, 8), is fine.
- Recommended approach A: two attributes become IR decorations (the `[WaveSize]` path) and are emitted after `__global__` in
  `CUDASourceEmitter::emitFunctionPreambleImpl`. Diagnostics: a warning on non-CUDA targets, an error when both are present, and an error
  when maxThreads is less than numthreads. `__maxnreg__` gets a ≥12.4 macro in the prelude. B (raw passthrough) and C (TU-wide / derive-by-default) are rejected.
- #14029 is complementary, not a duplicate (same kernel); keep the attribute spellings consistent.
- Maintainer questions: (1) accept the feature? (2) naming: `CudaLaunchBounds`/`CudaMaxRegisters`, the literal CUDA names, or target-neutral
  `MaxThreadsPerGroup`; (3) the variant derived from numthreads, since named attribute args do not parse (E20001); (4) gating for `__maxnreg__`;
  (5) mutual exclusion as an error or a warning? (6) do the attributes also apply to `[CudaKernel]` functions that are not entry points?

**GitHub state (verified 11-01 ~14:45Z).** Type=Feature (set by the bot at 14:35Z; not a comment, so it does not break R6, and #14029 is a precedent); no labels; 0 comments.
The draft comment for after the hold is in the triager's memory/issues/comment-14135.md.

**Next.** The triager's one-shot `t-422839` fires 2026-11-05T14:35Z. It posts the parked 5-bullet unless a
`Fixes #14135` PR or maintainer direction appears first. A fixer chain needs maintainer direction on Q1–4 and the operator's go-ahead.
Owner: slang-triager, thread `gh-issue-shader-slang/slang-14135`.

**11-02 (reported by the #14029 triager).** The reporter opened **#14149** "CUDA: add [CudaLaunchBounds] and
[CudaMaxRegisters] kernel attributes" (`Fixes #14135`; open, not a draft, head d8501858d; I verified it). `t-422839`
already defers to a `Fixes #14135` PR, so it should validate #14149 and must not post a competing plan. No dispatch.
