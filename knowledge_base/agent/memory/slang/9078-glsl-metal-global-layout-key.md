---
type: chain
title: slang#9078 — GLSL→Metal "no outer func at use site for global"
description: A GLSL global varying out crashes introduceExplicitGlobalContext on Metal. jhelferty-nv specified a producer-side fix in lowerTypeLayout; dispatched to slang-fixer.
tags: [metal, glsl, ir-lowering, layout]
---

# slang#9078 — GLSL→Metal global varying crash

- **2026-08-18:** slang-triager re-verified the crash at `9a948c67`. It still reproduces as `SLANG_UNEXPECTED` at
  `slang-ir-explicit-global-context.cpp:734`. Finding:
  https://github.com/shader-slang/slang/issues/9078#issuecomment-5329852285. The fix chain was held because the
  comment only asked for a repro check.
- **2026-10-06:** jhelferty-nv asked for the fix and gave a design
  ([comment 6023678901](https://github.com/shader-slang/slang/issues/9078#issuecomment-6023678901)):
  - In `lowerTypeLayout`, key a pointer-valued global by the declaration's IR inst, not by `getSimpleVal`
    (that produces a load).
  - In `collectGlobalUniformParameters`, update every layout that uses the key, including the offset-element
    layout. Don't collect GLSL in/out globals as uniforms.
  - Leave the Metal passes and pass gating alone. Don't add a band-aid pass.
  - Tests: the Metal regression, no asserts on CUDA and C++, and existing global-varying tests stay green.
  - Dispatched to `slang-fixer` on `gh-issue-shader-slang/slang-9078` (msg 15), with the brief verbatim plus
    `<github-post-authorized />`.
- **2026-10-06 19:20:** slang-fixer claimed it (msg 16). Branch `fix/issue-9078` @ `c8e02397a7`, worktree `wt-slang-9078`, build ETA 20 min.
- **2026-10-06 23:49:** **Draft PR #13467** (`fix/issue-9078`, head `246ed6e7ae`, +71/−9, 4 files, `Fixes #9078`, PR mapping set
  to the fixer's session `sess-1791314309105-wpnzrt`). The 5-bullet is on the issue
  ([6027607097](https://github.com/shader-slang/slang/issues/9078#issuecomment-6027607097)).
  - The fixer reports: Metal compiles; CUDA and C++ give the existing "user-defined varying" diagnostic instead of asserting;
    the 26 existing GLSL varying tests pass; full slang-test is 7514/7515, and `gfx-smoke` fails on master too.
    I haven't verified these results myself.
  - `tests/glsl/global-uniform-with-varyings.slang` checks became CHECK-DAG, because the GLSL emits the same declarations in a different order.
  - **Open maintainer question:** on CPU/CUDA, global in/out still get uniform size (`slang-type-layout.cpp:2278-2285`, `2545-2552`). Once
    these globals are no longer collected, a compute shader with `out` before `uniform` compiles, but its `GlobalParams` offsets disagree
    with reflection and the CPU run crashes. That is a silent miscompile where master asserted. The issue's shader is unaffected.
    Options: (a) give them zero uniform size in this PR, (b) reject them on CPU/CUDA, (c) follow-up.
  - slang-reviewer peer review is pending. Re-chase `rechase-9078-jhelferty-4047` is set for 2026-10-09.
- **2026-10-07 01:42 — `[Fix Report]` (Partial; msg 32).** Head `302264acd3`, still a draft, 5 files. A vertex/global-`in` test was added.
  The fixer reports the new tests at 8/8 vs 2/8 on master; I haven't verified that. CI run 37557182692.
  - slang-reviewer: REQUEST_CHANGES, round 1/2. The blocker is **wider** than first reported: every global after a user in/out is
    mis-offset on CPU/CUDA, including resources. Example: `out float4 o; RWStructuredBuffer<float> b;` → reflection says 16,
    GlobalParams says 0, and a `-cpu` run reads the wrong data. The reviewer recommends (a).
  - The correction is on the issue ([6028733641](https://github.com/shader-slang/slang/issues/9078#issuecomment-6028733641)), along with the a/b/c choice
    and an OK request for the CHECK-DAG test change. (c) alone keeps the draft blocked. On the answer: implement it,
    add a CPU runtime test, then review round 2.
- **Next:** wait for jhelferty-nv (re-chase `rechase-9078-jhelferty-4047`, 2026-10-09).
