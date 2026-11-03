---
type: chain
title: slang#13571 — WGSL matrix negation emitted as `matNxM<f32>(0) - m`
description: "andy-slater, human-filed WGSL codegen bug: unary minus on a matrix emits an invalid single-scalar matrix constructor. Follow-on to #12908 / our merged PR #12909. Dispatched to slang-triager 2026-10-11."
---

# slang#13571

**2026-10-11 19:2xZ, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments,
no labels, no assignee, human-filed by andy-slater, `updated_at` = `created_at`, live body length
matches the payload. The only session on `gh-issue-shader-slang/slang-13571` was this Main
webhook session, so nobody owned it.

Context: #12908 (natevm, closed) was the vector-negation parenthesization bug; our PR #12909
(merged 2026-09-12) fixed the parentheses for vectors and matrices but left the
`matNxM<f32>(0) - m` form, which WGSL rejects (no single-scalar matrix constructor, no unary `-`
on matrices). Reporter's accepted forms: `m * -1.0f` or per-column `matNxM(-m[0], -m[1])`.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13571`.

**2026-10-11 20:15Z, triaged** (slang-triager, [cmt 6113276208](https://github.com/shader-slang/slang/issues/13571#issuecomment-6113276208)):
bug / P2 / target-emit (WGSL), labels `reproduced` + `WebGPU`, Type=Bug. Root cause is the WGSL
`kIROp_Neg` case in `slang-emit-wgsl.cpp:1756-1778`, which lowers both vector and matrix negation
to `(T(0) - x)`. It isn't a #12909 regression: the `T(0)` form came in with #7936 (v2025.14,
mirroring Metal), and the older base `-m` was never valid WGSL either. #12909's test
`tests/wgsl/neg-vector-precedence.slang:41` pins the invalid form and has to be updated.
Recommended fix A is `(T(-1) * x)` for matrices, which keeps -0 parity. The prototype passes naga on 17
variants. Rejected: B `matCxR<T>() - x` (loses -0), C IR legalization, D per-column.

**20:16Z, handed to `slang-fixer`** (`sess-1791749819525-d9mn82`, same canonical thread):
draft PR `Fixes #13571`, non-breaking. The triager owns the issue side and the fixer owns the PR side.

**Open side decision (operator):** sibling gap where scalar `uint` negation emits `- x`, which naga
rejects, and `(u32(0) - x)` validates. It's out of the PR scope and mentioned publicly in the
triage comment. Not filed. Whether to file it is the operator's call.

**2026-10-11 22:21Z, draft PR [#13572](https://github.com/shader-slang/slang/pull/13572)** (verified live): head
`d08201af30`, `fix/issue-13571`, `pr: non-breaking`, closes #13571, 3 files +115/−12 (`slang-emit-wgsl.cpp`,
new `tests/wgsl/matrix-negation.slang`, updated `neg-vector-precedence.slang`). The pr-mapping goes to the fixer session.
The fixer is waiting on the slang-reviewer verdict before sending its final [Fix Report]. The triager edited its comment to say "fix in draft PR #13572". Re-chase: `rechase-13571-wgsl-matne-de5e` (10-13 16:00Z),
which also re-asks the operator about the scalar-uint sibling if it's still open.

**2026-10-12 14:00Z, triage resolved** (verified live). Draft #13572 is at head `46ac7f64a7`: 9 bot commits, 5 files
+160/−17. It adds `legalizeMatrixTypes` (`slang-ir-legalize-matrix-types.{cpp,h}`), which lowers every non-float matrix on WGPU so that
int64/int16/uint8 never reach the float-only Neg branch. Master already rejects those types with E38203, and the test pins it.
Internal slang-reviewer ran 2 rounds, both REQUEST_CHANGES with 0 bugs and 2 gaps each. All gaps are fixed, but the round-2 fixes
weren't re-reviewed because of the 2-round cap. Devin timed out in both rounds. The PR description uses the repo hook's 4-section format, not the CLAUDE.md 5-part one
(rationale: explain cmt 6114547878). jkwak-work is assignee and requested reviewer, with 0 GitHub reviews so far. CI run 38259151868 is
`waiting` on the workflow_dispatch approval gate. Re-chase `rechase-13571-wgsl-matne-de5e` has been refreshed.

**Unfiled follow-ups (operator call, asked 10-11 / 10-12):** (1) scalar `uint` `-u` emits `- x` on WGSL; (2) the CPU
prelude `SLANG_MATRIX_UNARY_OP` indexes `result[i].rows[i][j]` (wrong index), so float-matrix `-m` breaks on `-cpu`;
(3) double matrices ICE on WGSL and BFloat16 matrices emit invalid WGSL; (4) float-matrix `%` emits invalid WGSL.

**2026-10-13 16:00Z, re-chase (no change).** Verified live: draft #13572 is still at head `46ac7f64a7`, last updated 10-12 13:55Z, with 0 reviews
and no human comments on #13571 or #13572. The only event is jkwak-work milestoning #13571 to "Q4 2026 (Fall)" (10-12 16:22Z). CI run 38259151868
is still `waiting`, and the pull_request CI jobs are SKIPPED because the PR is a draft. The status went to orchestrator-dashboard only. The 4 follow-ups
were re-asked there (3rd ask, msg id 11); none is filed (search confirmed). Next one-shot is `rechase-13571-wgsl-matne-7189` at 10-16 16:00Z.
If that ask is still unanswered then, park it and don't re-ask.

**2026-10-16 16:00Z, re-chase (no change).** Verified live: draft #13572 is still at head `46ac7f64a7`, last updated 10-12 13:55Z.
It has 0 reviews (jkwak-work is the requested reviewer and assignee) and no human comments or timeline events on #13571 or #13572
since 10-13 16:00Z. CI run 38259151868 is still `waiting`. The fixer session `sess-1791749819525-d9mn82` is active but its container
is stopped, last active 10-12. Nothing was routed. Status went to orchestrator-dashboard only.
**The 4 follow-ups are PARKED-UNANSWERED.** I read the dashboard session from seq 498209 to 505358 (10-10 to 10-16 15:51Z) and found no
operator reply to the 10-13 3rd ask (row 500418). Per the standing order I don't ask again. None is filed (GitHub search, created ≥10-11).
Act on them only if the operator brings them up. Next one-shot: `rechase-13571-wgsl-matne-ef8e` at 10-20 16:00Z.

**2026-10-20 16:00Z, re-chase `-ef8e` (unchanged #3 of 3) → PARKED.** Verified live: draft #13572 is still OPEN at head
`46ac7f64a7`, last updated 10-12 13:55Z, 9 commits. It has 0 reviews (jkwak-work is the requested reviewer and assignee),
0 inline comments, and no timeline events on #13571 or #13572 since 10-16 16:00Z. #13571 is OPEN with labels `WebGPU` +
`reproduced` and the Q4 2026 (Fall) milestone. **CI run 38259151868 now returns 404 and the head SHA has 0 Actions runs or
check-runs.** The gated run was removed, not completed. The same thing happened to #13590's gated run 38462553148, so it is a
repo-wide cleanup of old `waiting` runs (the oldest live `waiting` run is from 09-16) and not specific to this PR. Whoever flips the PR
ready has to re-trigger CI. Nothing was routed and nothing was posted to GitHub. Status went to orchestrator-dashboard only.
The dashboard session from seq 505360 to 506340 (10-16 16:02Z to 10-20 15:54Z) has no operator answer on the 4 follow-ups, so they
stay PARKED-UNANSWERED and I didn't re-ask. None is filed. **No re-chase re-armed.** The chain is in the parked-chain register
(`.task-hygiene/state.json` `parked["shader-slang/slang#13571"]`, refs #13571 + #13572, count 3), and `reports/parked-chains.md`
was regenerated. Webhooks still deliver review and comment events to the fixer session through the pr-mapping. To resume, run
`task-hygiene.py unpark shader-slang/slang#13571`.

**2026-11-02 13:00Z, UNPARKED for #14179.** [#14179](14179-wgsl-vector-negation-signed-zero.md) (vector negation
loses -0) is folded into #13572. Fixer woken: merge master now (CONFLICTING in legalize-matrix-types), then the #14179
vector change, which stays local until R6 ends 11-06 12:21Z. Still needs a human to mark it ready and re-trigger CI.

**2026-11-02 13:23Z, Part 1 done** (fixer [Report]; verified live). Master was merged in with no rebase. Head is now `5be2d78f1b`
(`46ac7f64a..5be2d78f1` was a fast-forward push). The legalize files now match master exactly, because master's `shouldLegalizeMatrixType`
(`bool || isIntegralType`) already covers this PR's rule. The PR diff is just `slang-emit-wgsl.cpp`, `tests/wgsl/matrix-negation.slang` and
`tests/wgsl/neg-vector-precedence.slang`. The emitter assert now uses `!isMatrixTypeLegalizedToVectorArray(...)`. The int64/int16/uint8
rows were dropped and an `int2x2` guard row was added. CI run 41452561641 (workflow_dispatch) is `queued`. The PR is still a draft
and `BLOCKED`. Part 2 (#14179) is local only; the fixer's one-shot `pr13572-r6-push-14179-2403` fires 11-06 12:25Z. Whether to release it early is
the operator's open question from 12:45Z about chains held under the stale R6 wait.

**New master bug (fixer):** since #13715 (jkwak-work, merged 10-21), `legalizeMatrixTypes` runs after
`validateVectorsAndMatrices`. So on WGSL, int64 matrices silently emit `vec2<i64>`, int16 gets E56103, and uint8 hits an
internal compiler error. The uint8 part overlaps open #10234 (int8 ICE on WGSL).

**Follow-up filing, 13:2xZ:** under the 10-31 unified rule ([filing policy](../orchestrator/filing-verified-issues-policy.md)), a
verified, deduped bug on a shader-slang repo is filed without asking. That replaces the "PARKED-UNANSWERED, act only if the operator
raises it" stance above for the 4 follow-ups. I sent the triager (`sess-1791746794465-t97mo5`, canonical thread) the job of re-verifying
all 5 on current master, deduping them (including against #10234), and filing the survivors. No fixer chains.

**2026-11-02 13:33Z, Part 2 (#14179) committed LOCALLY only** (fixer). The Neg vector branch now handles only unsigned-integer vectors
(`isIntegralType(e) && !getIntTypeSigned(e)`). f32, f16 and i32 vectors fall through to the base `- x`. New test `tests/wgsl/vector-negation.slang`;
the `neg-vector-precedence.slang` golden now expects `= - (a + b) + - (a - b)`. tests/wgsl 148/148, other WGSL tests 911/918 (the 7 are the master `functional/codegen` failures).
The PR description (`Fixes #13571` + `Fixes #14179`) and the explanation are drafted in the fixer's `reports/`. The push is gated on `pr13572-r6-push-14179-2403`
(11-06 12:25Z) unless the operator releases the stale-R6 holds earlier. If they do, wake `sess-1791749819525-d9mn82` to push now.

**2026-11-02 13:42Z, follow-ups FILED** by slang-triager (verified live, author `app/nv-slang-bot`, all 13:42:31–34Z):
[#14184](https://github.com/shader-slang/slang/issues/14184) scalar `uint` `-x`; [#14185](https://github.com/shader-slang/slang/issues/14185)
CPU prelude `SLANG_MATRIX_UNARY_OP` index; [#14186](https://github.com/shader-slang/slang/issues/14186) BFloat16/FloatE4M3/E5M2 no WGSL
type name; [#14187](https://github.com/shader-slang/slang/issues/14187) float-matrix `%`; [#14188](https://github.com/shader-slang/slang/issues/14188)
int64 matrices emit `vec2<i64>` without E38203 (labels `WebGPU` + `reproduced`; refs #13914, #10234, #14022). Their `issue_opened`
webhooks are this chain's own output: **no dispatch**, no fixer chains (per the 13:25 task). The triager's [Report] on
`sess-1791746794465-t97mo5` is still pending as of 13:43Z.

**2026-11-02 13:42Z, follow-up (4) filed as [#14187](https://github.com/shader-slang/slang/issues/14187)** (float-matrix `%` emits
invalid WGSL; filed by the triager `sess-1791746794465-t97mo5`, labels `WebGPU` + `reproduced`, body says "Found while triaging
#13571"). The `issue_opened` webhook reached Main; **no dispatch** — this triager chain owns it, and per the filing policy no fixer
chain starts without a report. At 13:4xZ the triager container was still running (last_active 13:25) and had not yet sent the
filed-numbers report for the other follow-ups. Expect more bot-filed `issue_opened` webhooks from this batch: same handling.

**2026-11-02 13:42Z, follow-up (2) filed as [#14185](https://github.com/shader-slang/slang/issues/14185)** (nv-slang-bot, label
`reproduced`; CPU prelude `SLANG_MATRIX_UNARY_OP` `result[i].rows[i][j]` at `prelude/slang-cpp-types-core.h:629`). This is the
triager's filing from the 13:25Z task (seq 10), and its batch [Report] is still pending. The `issue_opened` webhook reached Main
(`sess-1793626954835-j7bbys`), and no other session is on the thread. **Not dispatched**: the chain owns it, and the task said
"no fixer chains". A fixer chain for any of the filed follow-ups is a decision to report to the operator.

**#14184 webhook (13:42Z, `sess-1793626953462-062fja`): not dispatched**, same reason. Open question for when the triager's [Report] lands:
#14184 sits in the same `kIROp_Neg` case as #13572 Part 2 (unsigned vectors), so folding it in is one more unsigned-scalar branch.

**2026-11-02 13:43Z, follow-ups FILED** by slang-triager (from the #13571 session, re-verified on master 6815ed82d; I checked all 5 live:
bot-authored, `reproduced` label, 0 comments, no @-mentions, no mention of #14179). **Their `issue_opened` webhooks are our own filing's
self-echo, so they are filed-only and need no dispatch.** No fixer chains; starting any is the operator's call.
- #14184: WGSL scalar `uint` negation emits `- x` (Tint rejects it). The #14179 vector change doesn't cover scalars.
- #14185: CPU prelude `SLANG_MATRIX_UNARY_OP` uses `result[i].rows[i][j]`, so float-matrix `-m` and int-matrix `~m` don't compile on `-cpu`. Dates from #2734.
- #14186: WGSL `BFloat16`/`FloatE4M3`/`FloatE5M2` have no type name, so they emit `mat2x2<>` and scalar conversions are lost (slang-emit-wgsl.cpp:777). Related to #14159 and #10750.
- #14187: WGSL float-matrix `%` emits `%` on `matCxR<f32>`.
- #14188: WGSL int64/uint64 matrices silently emit `vec2<i64>`. The cause is #14022 (merged 10-29), not #13715. Validation runs at slang-emit.cpp:2566, before legalizeMatrixTypes at :2669.
- Duplicates, no comment posted: double-matrix ICE is #10232; uint8/int8 matrix ICE is #10234.
- HLSL undeclared `BFloat16Type(...)`: reproduced with DXC (`cs_6_6`) at 13:46Z, but it is a **duplicate of #14159** (its body already names `-target hlsl`). Nothing filed, nothing commented.

**2026-11-02 13:4xZ, #14186 webhook (Main `sess-1793626955864-54gjrk`): no dispatch.** Follow-up (3), BFloat16 part only; the
double-matrix ICE half of (3) is not in #14186. Body: "Related: #14159 … Found while triaging #13571". Overlap to weigh in the
triager's [Report]: the [#14159](14159-metal-bfloat16-fp8-undeclared-types.md) triager's scratch fix (narrowing the 3 types'
`[require(cuda_sm_8_x)]` to `[require(cuda, cuda_sm_8_x)]`) measured E36107 on wgsl for all 3 types. That is #14186's "Expected"
result, so #14186 likely closes with the #14159 fix (that triager's finding, unverified). Reporter albertrodriguezclo owns the #14159 PR.
