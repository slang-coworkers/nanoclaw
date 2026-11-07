---
type: chain
title: slang#14183 — CPU target: `Atomic<float>::add` -> internal error E99999 "unexpected IR opcode during code emit"
description: Human-filed (albertrodriguezclo) 2026-11-02 13:33:27Z. `Atomic<float>*` add on -target cpp hits E99999 in emit; `Atomic<int>` add is fine. Triaged 13:53Z bug/medium/P2, approach B (cpp-emitter E55204 per unhandled op/type); slang-fixer picked it up 13:54Z.
resource: raw/slang-14183-triage-memo.md
tags: [cpu, cpp-emit, atomics, float, ice, triage]
---

# slang#14183 — CPU `Atomic<float>::add` ICE

**Ask.** `uniform Atomic<float>* pf; pf->add(1.0f);` with `slangc -target cpp` gives E99999 "unexpected IR opcode
during code emit". `Atomic<int>` add emits `_slang_atomic_add_i32`. Seen on 2026.16.1, 2026.19, master 6815ed82d.
Reporter expects a float prelude helper or a capability diagnostic (like E36107), not an ICE. Related: #13705
(`InterlockedAdd` E36107 on CPU), #10683 (`Atomic<T>` codegen, other backends). Same reporter as #14153/#14152/#14177;
sibling atomic finds today: #14173 (SPIR-V float sub ICE), #14174/#14175 (Metal).

**Dispatch (11-02 ~13:36Z, Main).** Memory grep on 14183: no hits. Only session on `gh-issue-shader-slang/slang-14183`
was my webhook session `sess-1793626410063-3oaflr`. Live: OPEN, 0 comments, no labels/assignee. Dup search (Atomic float
cpp; `_slang_atomic_add`; Atomic cpu target): nothing but #14183. R6 retired, so no hold. Sent to slang-triager.

**Triager ack 11-02 13:37Z (msg 8; their finding).** Reproduced on master 6815ed82d: cpp E99999; HLSL gives a clean
E55204; CUDA and SPIR-V compile. Now checking the C++ emit gap and the atomic-op census.

**Triage 11-02 13:53Z (msg 10; memo [raw/slang-14183-triage-memo.md](raw/slang-14183-triage-memo.md); their finding).**
Bug / medium / P2 / C++ emit + core module. Not a dup, not a regression (2026.13.1 is the same). The gap is wider than float
add. `struct Atomic<T>` carries `[require(cuda_glsl_hlsl_metal_spirv_wgsl)]` (core.meta.slang:4188), so load/store/exchange/CAS
give E36107 on cpp. The two `extension Atomic<T>` blocks (add/sub/min/max; bit ops/inc/dec) lack it. The cpp emitter only
handles `kIROp_AtomicAdd` for int widths (slang-emit-cpp.cpp:1367), so every other op or type gives E99999. On LLVM CPU targets
every atomic gives E99997. I spot-checked :4188, the unannotated extensions and the single `kIROp_AtomicAdd` case at 6815ed82d.
Options: A = `[require]` on the extensions (breaks working int add on CPU); **B (rec.)** = E55204 per unhandled op/type in
the cpp emitter (non-breaking); C = real CPU atomics (a feature, tied to #13705 part 2). A and C go to the maintainer on the issue.
Side finds, not filed: LLVM E99997 (optional in the same PR); HLSL emits `InterlockedAdd` for half/double with no diagnostic
(a hypothesis, dxc not run).
Next on the triager side: OUTPUT_REVIEW, then labels `reproduced` and Type Bug, then the issue post.

**Fixer 11-02 13:53Z.** The triager handed off directly to slang-fixer `sess-1793627606743-nurj2k` (canonical thread). The
fixer acked at 13:54Z: worktree `wt-slang-14183` on `fix/issue-14183` @ 6815ed82d, building. The fixer's parent edge is
the triager, so I don't write to the fixer directly.

**Triage posted 11-02 14:02:59Z (msg 22), verified live by me at 14:04Z:** comment
https://github.com/shader-slang/slang/issues/14183#issuecomment-6579101473 by nv-slang-bot, label `reproduced`, Type Bug.
OUTPUT_REVIEW passed in round 3 after 2 corrections: SPIR-V float `sub` = E99997 (#14173); int `reduceAdd`/`+=` also work on cpp.
The triager sent the fixer an acceptance update (msg 13): B keeps int `add`/`reduceAdd`/`+=` working. The PR says "Addresses
#14183" (not Fixes) unless a maintainer accepts a diagnostic as the resolution. The A/C choice is the maintainer's, tied to #13705 part 2.
The triager holds the chain open until the fixer's [Fix Report], then sends [Triage Resolution].

**PR + side findings (11-02 14:59–15:17Z, from the triager/fixer sessions; their findings).** The fixer opened draft PR #14189
(head 3bf9492, E55204 instead of E99999 on cpp); slang-reviewer is reviewing it (`sess-1793631941082-xg0qtx`, 15:07Z, ~90 min).
At 15:06Z the fixer reported 3 side findings. At 15:16Z the triager answered them (triager msg 19): Append/Consume E55204 location
goes into #14189 (the fixer replied at 15:17Z that it can't, and asked for a separate Bug); it would file the
property/subscript accessor gap and LLVM E99997 as new Bugs; **"No fixer chain without the parent's OK."**
- **#14190** "Property and subscript accessors do not enforce capability requirements": BOT-filed 15:17:43Z by the triager, label
  `reproduced`, 0 comments. **Its issue_opened needs no dispatch** (Main webhook session `sess-1793632666469-gd4cm2`, 15:19Z).
  Any fixer chain waits for the triager's report to Main and the operator's OK.
- **#14191** "LLVM CPU targets: `Atomic<T>` extension methods abort with E99997": BOT-filed 15:17Z by the triager; a sibling Main
  session (`sess-1793632666890-u2kleu`) received that webhook. **Its issue_opened needs no dispatch** (that session, 15:20Z:
  rung 7 hit, triager row 19 "I'm filing this as a new Bug that links #14183/#14189. Leave it out of #14189"). Filed-only; any
  fixer chain waits for the operator's OK.
- Append/Consume location: the fixer says a call-site location can't work (one shared synthesized atomic per buffer type).
  It offered (a) int inc/dec via `_slang_atomic_add_*` ±1, or (b) drop cpp/llvm from `[require]` (hlsl.meta.slang:126). It was not filed as of 15:18Z.
- **#14192** "CPU targets: `AppendStructuredBuffer.Append` / `ConsumeStructuredBuffer.Consume` abort with E99999 (cpp) / E41403
  (llvm), with no source location": BOT-filed 15:23:32Z by the triager, label `reproduced`, 0 comments, unassigned (live 15:26Z).
  **Its issue_opened needs no dispatch** (Main webhook session `sess-1793633014848-uyk7mo`). The issue lists both options above.

**Triager [Report] to Main 11-02 15:24Z (`3oaflr` row 24).** Asks: "Do you want a fixer chain for any of #14190–#14192? None will
start without your OK." It recommends #14190 as the most valuable (front-end capability hole, all targets). This is an operator
decision (new fixer chains); still waiting on the [Fix Report] for #14189.

**Draft PR #14189 + side bugs 11-02 15:24Z (msg 24).** I checked live: draft PR #14189 "Diagnose unsupported atomic operations on
CPU targets instead of E99999", head 3bf949220, `fix/issue-14183`, review requested from jkwak-work. It says "Addresses #14183".
The fixer posted the draft-PR verdict on the issue (cmt 6580362374). The triager filed 3 side bugs, #14190, #14191 and #14192, in
[14190-14192-cpu-atomic-side-bugs.md](14190-14192-cpu-atomic-side-bugs.md). I asked the operator for a go/no-go on fixers
(dashboard, ~15:27Z); timer `recheck-14190-92-operator` is set for 11-04 15:30Z. I told the triager to hold. The triager is still
waiting for the fixer's [Fix Report].

**#14189 R1 review 11-02 15:40Z (slang-reviewer `xg0qtx`, parent = the fixer; Main got a CC, msg 56; their findings; full text in
[raw/slang-14189-r1-combined-review.md](raw/slang-14189-r1-combined-review.md)).** APPROVE_WITH_NITS: 0 bugs, 1 gap, 6 nits, plus a
tested remedy patch (+18/−11) for N1–N5. Full `slang-test` on head: 11147/11150 (only the known `fp8-cuda*` failures). G1: the PR
summary "E55204 at the user's call" isn't true for Append/Consume (no location, #14192), so narrow it and add `Related: #14192`.
N1: `docs/cpu-target.md:18` still says atomics aren't supported. A drill showed a per-method `[require]` alternative breaks the core
module (E36108 via `atomic_reduce`). CI run 41466582949: `wait-for-human-priority` failed, so builds/tests were skipped and there is
no CI evidence yet. Side finds: S1 = #14190 (dup); S2 = the default formatter drops the span text of a location-less diagnostic
(not filed; per the side-find hold it goes reviewer → fixer → triager). I sent no reply; the fixer owns the R1 follow-up.

**[Fix Report] 11-02 16:06Z (slang-fixer, msg 90; I verified the PR live at ~16:07Z).** #14189 is a draft at head 555cf1f2a (6 commits),
`pr: non-breaking`, review requested from jkwak-work. The body says "Addresses #14183" (not Fixes) and mentions #14192. R1 G1 and
N1–N6 are applied; the reviewer asked for no further round. Full slang-test 11147/11150 (known fp8 CUDA failures only). A/B over
132 files: CUDA/HLSL/SPIR-V byte-identical. CI: every build/test job is SKIPPED because it's a draft (run 41475009959), so no CI
evidence yet. **Next: a human must click "Ready for review"** (a fixer can't, see
[../feedback_fixers_cannot_request_reviewers.md](../feedback_fixers_cannot_request_reviewers.md)). I asked the operator on the
dashboard ~16:08Z. The triager's [Triage Resolution] is still to come.

**11-06 reporter scope ask (slang-fixer [Report], msg 92, 23:08Z; I verified both comments live at ~23:10Z).** albertrodriguezclo
on #14189 (cmt 6697868014, 22:57Z): the E55204 is better, but #14183 needs float `add` to *work* on CPU so the kernel compiles for
SlangPy's CPU device. They ask whether a prelude helper (CAS loop over `uint32_t`, or `std::atomic_ref` where C++20 exists) is OK in
this PR. The fixer replied (cmt 6698054452, 23:08Z) with no code change: it's feasible (slang-rhi CPU = `host-callable` → this
emitter; CAS loop with the existing per-compiler builtins; downstream builds use C++17, so `atomic_ref` needs a build change). It
listed the scope questions (`double`; `sub`/`min`/`max`) and said the decision is a maintainer's. The PR stays diagnostic-only.
- **Ownership:** #14183 is assigned to jkwak-work, milestone Q4 2026 (Fall). jkwak-work is the shepherd of #14189 and its requested
  reviewer. No maintainer has commented on #14183, #14189 or #13705.
- **State: PARKED on jkwak-work's scope call** (a = float add in #14189, b = follow-up PR, c = neither). On (a)/(b) the fixer
  (`nurj2k`, PR-mapped) implements it. #14189 is still a draft at 555cf1f: **ready-flip pending**, on the weekly list
  ([../orchestrator/undraft-asks-replaced-by-weekly-list.md](../orchestrator/undraft-asks-replaced-by-weekly-list.md)), no per-PR ask.
- **Timer:** one-shot `recheck-14189-scope-d160`, 11-13 15:00Z. I named the decision on the dashboard at ~23:12Z.
