---
type: chain
title: slang#14036 — CUDA `precise` / `-fp-mode precise` leave no trace in emitted .cu (FMA contraction)
description: Human-filed (albertrodriguezclo) feature request 2026-10-29 17:10:20Z, cloth-sim batch. Triaged feature/medium/P2 (CUDA emit) by slang-triager. Parked on maintainer direction (jkwak-work, tangent-vector); R6 hold, re-check t-4a15ea 2026-11-02 17:30Z.
tags: [cuda, precise, fp-mode, fma, feature-request, parked, r6]
resource: /workspace/inbox/a2a-1793294503154-lqb5sc/triage-14036.md
---

# slang#14036 — CUDA `precise` / `-fp-mode precise` → `_rn` intrinsics

**Ask.** On `-target cuda`, `precise` is dropped (warning E56005), and the `-fp-mode precise` `.cu` is byte-identical to the default.
So nvcc contracts `a*b+c` into an FMA, and a ported kernel is bit-exact only under a file-wide `--fmad=false`.
The reporter wants `precise` values, and the whole module under precise mode, emitted as `__fmul_rn`/`__fadd_rn`/`__fsub_rn`.
An explicit `fma()` stays `fmaf`.

**Triage (slang-triager, 10-29 17:21Z, master 9b3ac252d). These are the triager's findings; I did not reproduce them.**
- Reproduced: E56005 is emitted, and the md5 of the default and precise `.cu` files is the same. nvcc 12.6 sm_89 turns `a*b+c` into `fma.rn.f32`, and the `_rn` form stays as a separate mul and add.
- Ask 3 already works: `fma`/`mad` lower to `::fmaf`.
- nvcc ignores the `FP_CONTRACT` pragmas. So the only lever in the source is the `_rn` intrinsics.
- Slang's own `-target ptx -fp-mode precise` already passes NVRTC `--fmad=false` (PR #12801). That covers slang-rhi/SlangPy for the global mode.
- The gap: offline nvcc on the `.cu` text, and per-value `precise` on every CUDA path.
- Approaches:
  - **A (recommended):** under precise mode, the CUDA emitter writes `_rn` for scalar ops. The prelude vector/matrix ops get `_rn` behind `SLANG_CUDA_ENABLE_PRECISE_MATH`, which mirrors the fast-math define from PR #12872.
  - **B:** share `computePreciseInsts` out of the SPIR-V emitter. This collides with tangent-vector's #13324 refactor.
  - **C:** wait for an IR precise marker from #13324.
- Related issues: #12799/#12801 (closed), #13324, #13689 (Metal).

**GitHub state (verified 10-29).** Issue Type=Feature and the `reproduced` label were set by the bot. 0 comments: R6 holds a bot comment until 11-02 17:10:20Z.
No fixer has been dispatched.

**Side note.** Reporter PR #13943 (Metal `-fno-fast-math` for `-fp-mode precise`) was MERGED 10-28 22:10:33Z (verified). That merge is one of #13689's resume triggers. The triager recorded it, and nothing else was done.

**Next.** The triager's one-shot `t-4a15ea` runs 2026-11-02 17:30Z. It posts the parked 5-bullet unless a human has moved the issue on. If there is a reporter PR, it records the PR and does not compete.
If there is maintainer direction, the triager hands off to slang-fixer. Owner: slang-triager, thread `gh-issue-shader-slang/slang-14036`. Memo: see `resource`.
