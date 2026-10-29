---
type: project
name: project_13973_builtin_call_constant_fold_history
description: "Dated history of the slang#13973 / PR #13975 constant-fold chain and its fan-out (#13978/#13984, #13983/#13988, #13985/#13993, #13986/#13991, filed-only #13989/#13990/#13994), 10-28 15:32Z → 22:41Z. Split from project_13973_builtin_call_constant_fold on 2026-10-29; new dated entries append here."
---

# slang#13973 / PR #13975: dated history (2026-10-28, UTC)

Current state, decisions and lessons: [[project_13973_builtin_call_constant_fold]].
"Verified" means Main checked it live. Reviewer files are under `/workspace/inbox/a2a-<id>/`.

## #13973 itself

- **15:32Z** `issue_opened` (andy-slater, external); Main session `sess-1793201570113-2tdabv`. Open, 0 comments, no labels.
- **15:33Z** dispatched to slang-triager. The first `send_message` failed with `database is locked` and wrote no row; re-sent from the final-response block.
- **15:40Z [Triage]** (memo `a2a-1793202059542-howlfg/triage-13973.md`): bug/medium/P2, reproduced on master 3218a7612 (also GLSL source, `max(3u,2u)`). Comment 6473487462 at 15:41:42Z; label `reproduced`.
- **15:42Z** slang-fixer `3rjtzd` claimed: `wt-slang-13973`, `fix/issue-13973` @3218a7612.
- **16:34Z** fixer interim: 5 commits, 4 const-eval tests pass (incl. vk on L40S); suite 11229/11232 (3 fp8-cuda, host issue).
- **17:04Z** draft **PR #13975** @a5ec65379 "Fold max/min/abs/clamp calls on compile-time constants". Verified 17:05Z: pr-mapping → `3rjtzd`; reviewer session `walgpl`; status comment 6475397674.
- **17:24Z** #13975 body and explanation comment cite #13978; Min/Max/Clamp read signedness from `BaseTypeInfo` (`_tryFoldBuiltinIntegerFunction`, slang-ast-val.cpp:2475); revert drill confirms `builtin-func-fold.slang:50`.
- **17:38Z PARKED.** jhelferty-nv comment 6476187464: "Per @tangent-vector, we should understand what the long term language design is for this first, and what the use cases are." Assigned to tangent-vector. Main relayed verbatim; fixer: draft, no pushes, record R1 only; triager: no new posts unless mentioned. Operator told; timer `recheck-13975-design-1ff4` 11-04 14:00Z set.
- **17:41Z** triager edited 6473487462 in place to say parked (verified). **17:42Z** fixer confirmed.
- **18:00Z R1 REQUEST_CHANGES** (`a2a-1793210410966-geklun/combined-review.md`, diff 021bc718…): fold correct on 20+ probes; M1/G1–G4/N1–N4 (see the state page). `remedy-r1.patch` delivered; 0 GitHub reviews. Reviewer's "Maintainer direction: none" was stale; Main corrected it. **18:01Z** fixer recorded R1, applied nothing.

## Fan-out chains

- **17:05Z** fixer side finding: uint64 compared as signed in constant folding. **17:15Z #13978** filed (nv-slang-bot 17:14:25Z): `>`/`>=`/`<`/`<=` wrong above INT64_MAX on cpu/vk/cuda; SCCP slang-ir-sccp.cpp:602 (:698-725), `tryFoldImpl` slang-ast-val.cpp:2453-2462, slang-check-expr.cpp:2696-2714. Own Main session `t5llhr`. **17:18Z** fixer `3s6rec` on `gh-issue-shader-slang/slang-13978`.
- **18:0xZ** reviewer's follow-up: `abs(uint)` lowers to SAbs. **18:15Z #13983** filed (vk/llvm give 1 for `abs(0xFFFFFFFFu)`; SAbs since #1921; hlsl.meta.slang:8044/:8065). Own Main session `r3im67`; fixer `tzhs3g` 18:16:54Z. See [[project_13983_abs_unsigned_spirv_llvm_identity]].
- **18:30Z #13978 → draft PR #13984** @1e719af7f "Fold uint64_t ordering comparisons as unsigned". The fixer found two more bugs; Main decided to file both as own chains, no comment on #13954.
- **18:36Z #13985** (uint64 loop trip count, slang-check-stmt.cpp:822/:1055-1081, fixer `80nd8r`) and **#13986** (SIGFPE on INT64_MIN / -1 or % -1; SCCP `evalDiv`/`evalRem` :660/:670 and slang-check-expr.cpp:2744-2755; cites #13954, #13545; fixer `6cxhqb`). See [[project_13985_uint64_loop_trip_count_signed]], [[project_13986_int64_min_div_neg1_sigfpe]].
- **19:41Z #13983 → draft PR #13988** @336b3d40c. **#13989** (cpu/cuda 8/16-bit `abs` does not compile) and **#13990** (`abs(INT_MIN)` UB on CUDA/CPU/LLVM) filed; **19:4xZ** Main held both filed-only.
- **20:06Z #13984 R1 APPROVE_WITH_NITS** (`a2a-1793218005500-8x48rl`): G1 `==`/`!=` vs `<=`/`>=` disagree on wrapped values → `_foldComparison` for all six.
- **20:21Z #13988 R1 APPROVE_WITH_NITS** (`a2a-1793218887737-5g9hbz`): the `-emit-spirv-via-glsl` rows pass on base; 2-line anchor fix. Devin failed ("Failed to analyze PR"), `reviewers_complete:false`.
- **20:28Z #13986 → draft PR #13991** @b3676909c; Risk line cites #13954 as partial overlap. Main kept the `tryFoldImpl` unsigned-division hunk.
- **20:44Z #13985 → draft PR #13993** @6c2fa0790. The loop removal is SCCP's (#13984). #13993 alone regresses `for (uint64_t i = ~0u; i < 0x100000000ull; i++)` (false E30514) via #13954's missing narrowing. Main: no new issue; #13954 listed as a merge prerequisite.
- **20:45Z #13983 [Triage Resolution]:** #13988 @7d7bbe5c9, 13/13 + hlsl-intrinsic 683/683; parked. FXC `abs(uint)` unverified (noted, not filed).
- **20:48Z #13978 [Triage Resolution]:** #13984 @4c9091e (9 commits, +297/−78); parked. Its `_tryConvertIntegerValueToBaseType` duplicates #13975's helper.
- **21:29Z #13991 R1 APPROVE_WITH_NITS** (`a2a-1793222983062-bbi15o/combined-review-13991-r1.md`): G1 helper comment false for narrow unsigned types, G2 host-dependent predicate, **G3 conflicts with #13984 in 3 files** → `remedy-13991/unified-on-merge.patch`. Main proposed order #13984 → #13991 → #13993.
- **21:35Z #13994** filed (SPIRV-Tools CCP SIGFPE on vector int64 INT64_MIN / -1; `const_folding_rules.cpp:2240-2266`, submodule b8c3b64b; workaround `-O0`). Own Main session `55rxs3` dispatched nothing and folded it into the 11-04 timer.
- **21:38Z #13993 R1 REQUEST_CHANGES** (`a2a-1793223493181-ko4ppl`): **B1** mis-folded low-side bound → false zero-trip + `MaxIters(0)` → wrong `bwd_diff` (cpu garbage, vk/cuda NaN). Fix is in the producer (#13954); prototype `a2a-1793223467062-y9levb/producer-experiment-13993.patch` (+37).
- **21:47Z** #13991 @497b7977f states the #13984 conflict and order. **21:52Z** #13986 [Fix Report]: parked; rebases after #13984.
- **22:04Z** #13993 R1 applied @9b5f00221; comment on #13954 declined. **22:31Z R2 APPROVE_WITH_NITS** (`a2a-1793226674182-ipwx7y`, diff e07fcbd3…). **22:40Z** #13985 [Fix Report]: #13993 @963a7b086, parked.
- **22:41Z** all 5 PRs verified drafts; no active fixer work; operator told.
