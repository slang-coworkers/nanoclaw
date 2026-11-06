---
type: chain
title: slang#14135 — CUDA `__launch_bounds__` / per-kernel register cap attribute
description: Human-filed (albertrodriguezclo) feature request 2026-11-01 14:29:21Z, cloth-sim batch. Triaged feature/medium/P2 by slang-triager 11-01 14:39Z. The work is owned by the reporter's PR #14149 (`Fixes #14135`), so our chain is CLOSED 11-05. The bot does not comment on the human PR. The triager is filing the pre-existing master assert on surplus attribute args, if it is not a duplicate.
tags: [cuda, emit, attributes, feature-request, r6, closed, reporter-pr]
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

⚠️ **The 11-01 "R6 hold" was the retired rule.** nanoclaw#1993 removed the wait on 10-24. See Core Memory: no waiting period.
I dispatched with the stale 4-day hold, so the triage comment was held back. Do not copy the pattern.

**11-05 14:51Z: t-422839 re-check (triager task session `sess-1793543883324-j7v38x`). These are the triager's findings.**
The parked brief was NOT posted and there were no GitHub writes, because #14149 is open and is not a draft.
- I verified: head f5b074350d, opened 11-01 23:24Z by albertrodriguezclo, no labels; issue assignee jkwak-work, 0 comments, Type=Feature.
- Triager validation on a Debug build on the L40S:
  - PR tests 8/8; cuda 148/148; diagnostics 1021/1021; compute 635/635.
  - Registers go from 80 to 64 with either attribute, and CUDA dispatches give correct output.
- Defects:
  - (1) Surplus args (`[CudaLaunchBounds(64,2,3)]`) assert in Debug at slang-check-modifier.cpp:451/487. This is **pre-existing on master** (`[numthreads(64,1,1,1)]`, `[WaveSize(32,64)]`), because `checkAttribute` never rejects too many args. CodeRabbit already flagged it on the PR.
  - (2) `[CudaLaunchBounds(32)]` with `[numthreads(64)]` gives no compile-time error, and the launch fails with CUDA_ERROR_INVALID_VALUE.
  - (3) Minor: no docs, no warning on non-CUDA targets, no <12.4 guard.
- The PR's CI, format and label checks are `action_required` (fork workflow approval). The PR also needs the `pr: non-breaking` label and the CLA. Shepherd jhelferty-nv.

**My ruling (11-05).** No bot comment on #14149, per the human-PR precedent (#13419/#13420/#13640/#13733); defects (2) and (3) are maintainer review items.
Defect (1) is a reproduced bug on master, so the triager dedups and files it without asking the operator (filing policy). No re-check timer: the PR's own webhooks and its merge close #14135.

**11-05 14:58Z: closed on the triager's side.** No posts on #14149 or #14135. The worktree, branch and sentinel are removed.
Spin-off filed: **#14349** ([record](slang-14349-surplus-attribute-args-unchecked.md)).
