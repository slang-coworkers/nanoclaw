---
type: chain
title: slang#14037 — `-target cuda` source using `half` needs a manual `-DSLANG_CUDA_ENABLE_HALF` for nvcc
description: Human-filed (albertrodriguezclo) bug 2026-10-29 17:10:21Z, cloth-sim batch. Triaged bug/medium/P2, reproduced (nvcc 12.6, sm_89). Fixed locally by slang-fixer 10-29 (approach A); draft PR from one-shot slang-14037-r6-push-7218 at 2026-11-02 17:45Z, after the R6 hold.
tags: [cuda, prelude, half, emit, r6]
---

# slang#14037 — CUDA source output does not define `SLANG_CUDA_ENABLE_HALF`

**Ask.** `slangc -target cuda` on a module that uses `half` succeeds, but `nvcc -cubin` on the output fails
(`__half` / `F16_max` undefined) because the prelude includes `<cuda_fp16.h>` only under
`#ifdef SLANG_CUDA_ENABLE_HALF`. The NVRTC path (`-target ptx`) passes the define itself. Expected: emit
`#define SLANG_CUDA_ENABLE_HALF 1` before the prelude include when the module uses `half`, as
`-fp-mode fast` already does for `SLANG_CUDA_ENABLE_FAST_MATH`. These are the reporter's claims; not reproduced by me.

**GitHub state (verified 10-29 at dispatch).** 0 comments, no labels.
**R6:** no `bot-ok`, no crash word (`error: identifier ... undefined` is an nvcc diagnostic, not a crash),
so the bot holds any comment until `created_at`+4 d = **2026-11-02 17:10:21Z**.

**Related.** #14029, #14033 (CUDA prelude / host header, same batch).

**Triage (slang-triager, 10-29 17:35Z, master 9b3ac252d) — its findings; I spot-checked the emitter/prelude lines only.**
- Reproduced; `-target ptx` builds. Type=Bug + `reproduced` label set (no comment).
- Root cause: `m_extensionTracker` already records half/bf16/fp8 use, but only the NVRTC path turns it into `-D` defines
  (slang-code-gen.cpp:586-597); `CUDASourceEmitter::emitFrontMatterImpl` (slang-emit-cuda.cpp:401-411) writes only FAST_MATH.
  docs/cuda-target.md:263 already promises the define.
- Wider than reported: BF16 and FP8 have the same gap, and prelude:746 gates `SLANG_MAKE_VECTOR` on `RTC || HALF` only, so
  `-DSLANG_CUDA_ENABLE_BF16`/`_FP8` alone still fails under nvcc.
- Memo: `/workspace/inbox/a2a-1793295333014-d66nk4/triage-14037.md`.

**Routing decision (Main, 10-29).** Fixer, approach A, one PR (all three defines + the :746 gate; the same mechanism and
function, so splitting would leave a known gap). Following the #14032 precedent, **nothing may touch #14037's timeline
while R6 holds**: no comment, no pushed commit or PR referencing it. The fixer prepares locally now and opens the draft
PR from a one-shot after 11-02 17:10:21Z, standing down if a human commented, self-assigned or opened a PR in the meantime.

**Timers.** Triager `t-8bb71d` 11-02 17:15Z posts the triage comment ("handed to slang-fixer, fix incoming"). Its skip conditions were aligned with the fixer's at 10-29 17:40Z:
if, after 10-29 17:35Z, there is a human comment (the reporter counts), an assignee or a human PR (drafts count), it stands down and reports; with a newcomer label it never posts.
The fixer's push/PR one-shot runs after it (≥17:45Z).

**Fix ready locally (slang-fixer, 10-29 19:01Z — its figures, not re-run by me).** `fix/issue-14037` @ base 63f45a662,
worktree `/workspace/agent/wt-slang-14037`, 4 commits, +101/−3. The prelude makes `SLANG_MAKE_VECTOR` unconditional instead of widening :746.
It reports: new test 8/8 (fails on master); nvcc sm_89 without `-D` builds the repro, bf16-only and fp8-only modules;
`tests/cuda/` 147/147 on the L40S. 3 `tests/cooperative-matrix/fp8-cuda*` failures (`CUDA_ERROR_INVALID_PTX`) fail the same with the change reverted,
so they are pre-existing on this GPU. The same class was seen on #14013.
Push/PR one-shot **`slang-14037-r6-push-7218`** 11-02 17:45Z; handoff `/workspace/agent/reports/slang-14037-handoff.md`.

**Decisions (Main, 10-29).**
- `bot` label: the label does not exist (only `bot-ok`). R9's labeling workflow #13588 is still a draft, and the gap was flagged to the operator 10-29 (#14032).
  So: apply `bot` if it exists at fire time, otherwise omit it and proceed. No label is created by the bot. The `bot` label in my dispatch was my own addition.
- Accepted with disclosure in the PR body: losing NVRTC `-pch` for half/bf16/fp8 on `-target ptx` (same as FAST_MATH; follow-up, not in this PR),
  and no CI coverage of the prelude gate change (verified by hand with nvcc).

**Next.** One-shot fires 11-02 17:45Z → draft PR → slang-reviewer. Owners: slang-triager + slang-fixer, thread `gh-issue-shader-slang/slang-14037`.
