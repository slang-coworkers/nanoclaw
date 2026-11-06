---
type: chain
title: slang#10232 — `double` on WGSL/Metal gives ICE E99997 instead of a diagnostic
description: Human-filed (rkoivunen-sw, 2026-02-26, `fuzzed`), assigned to jkwak-work. On 11-04 16:49Z jkwak-work asked @nv-slang-bot to triage. TRIAGED 17:01Z (P2, rec A = late pre-emit check); triager handed off to slang-fixer. 17:59Z jkwak-work redirected the fix to the capability system, and the comment was relayed to the fixer.
tags: [wgsl, metal, double, fp64, ice, capability-system, pr-14332, draft]
resource: raw/triage-10232.md
---

# slang#10232: `double` on WGSL/Metal gives ICE instead of a diagnostic

**Origin.** Filed 2026-02-26 by rkoivunen-sw with the `fuzzed` label. Assigned to jkwak-work, milestone Q4 2026 (Fall).
skiminki-nv added a second repro on 07-09 (a `double` param with `0.0LF`). Earlier chains (#13571, #13350/#13355) cited
this issue as the canonical double ICE and filed nothing new.

**11-04 16:49Z.** jkwak-work commented "@nv-slang-bot can you triage this issue?" (comment 6636509202). The issue was
DISPATCHED to slang-triager on `gh-issue-shader-slang/slang-10232`, post-authorized.

**11-04 17:01Z: TRIAGED.** These are the triager's findings. I verified that the bot comment exists and the `reproduced`
label is present.
- Triage comment: 6636793334. Labels added: Type=Bug and `reproduced`; `fuzzed` was kept.
- Reproduced on master 3da6f63c0. The result is E99997 (exit 254), and v2026.13.1 gives the same result, so this is not
  a regression. The crash sites are slang-emit-wgsl.cpp:565/:1247 and slang-emit-metal.cpp:1371.
- Layer: nothing before emit rejects `double`. Recommendation A is a DoubleType case in the late hoisted-type check
  `checkUnsupportedInst` (slang-ir-check-unsupported-inst.cpp), using PR #12671 as the template. The check must also run
  under `-minimum-slang-optimization`. A check-time `[require(fp64)]` gate is rejected because it would break code where
  the double folds away; that question belongs to umbrella #4947.
- Dedup: #10233 is the reporter's stale draft. It adds a test only, has no CHECK lines, and was left untouched. Sibling:
  #10234 (int8). #13356's risk note and #13355's `packDouble2x32` are covered by the same check.

**Owners (11-04 17:02Z).** slang-triager `sess-1793811091871-2fijic`; slang-fixer `sess-1793811654478-vr0qdh` (live
17:00Z). Only one session per group.

**11-04 17:59Z: maintainer redirect.** jkwak-work (comment 6638052514): "This should be handled by Slang capability
system rather than crashing or printing an error message." (WGSL and Metal have no `double` and no extension for it.)
That replaces rec A. No PR existed yet. I relayed the comment verbatim to slang-fixer, pinned to vr0qdh with
in_reply_to=22 (it landed as fixer seq 6, no new session), and sent an FYI to the triager (no post). The fixer owns the
GitHub reply: it acknowledges the direction, outlines the capability approach, and asks jkwak-work about the triager's
folded-code finding (a check-time gate rejects `double d = 1.25; o[0] = (float)d;`, which compiles today; umbrella #4947).

**11-04 19:07Z: PARKED on jkwak-work.** The fixer replied on the issue (comment 6639554148, verified). Its plan: an `fp64`
alias (`cpp|cuda|glsl|hlsl|spirv|llvm`), `[require(fp64)]` on core `double`, and `[require]` fixes on `__min/__max` and
`copysign`. In the prototype, both repros give E36107 at the user's line on WGSL/Metal, and other targets are unchanged.
The open question for jkwak-work is whether folded doubles (`double d = 1.25; o[0]=(float)d;`) may now be errors. The
fixer also committed to having structs join their field types' capabilities in the same PR, because an unread `double`
field still ICEs. No PR yet. The rec-A commits are local only (wt-slang-10232). Timer: the fixer's one-shot re-check is
11-05 18:30Z. The operator was told once on the dashboard.
- Side finding: BFloat16/FloatE4M3 `[require(cuda_sm_8_0)]` gates nothing on metal/wgsl/hlsl. #14159 (OPEN) already covers
  Metal. 19:19Z: DROPPED. Nothing new to file: WGSL is #14186, and HLSL is already noted on #14159. The capdef detail (cuda_sm_8_x → sm_4_1 includes hlsl/metal/wgsl) is recorded in [14159](14159-metal-bfloat16-fp8-undeclared-types.md).

**11-04 21:05Z: RESUMED.** jkwak-work (comment 6642103509): "For, `tests/bugs/inf-float-literal.slang`, we should wrap
the double type case with `#if SUPPORT_DOUBLE/#endif` and add `-DSUPPORT_DOUBLE` on the target that supports double
type". That test was the one concrete consequence named in the folded-code question. My reading is that folded-double
rejection is accepted, but the maintainer did not say so in general terms. I relayed the comment verbatim to the fixer
(vr0qdh, pinned, in_reply_to=44). The fixer proceeds with plan items 1–4, applies the SUPPORT_DOUBLE pattern, states its
reading in the draft PR description, and runs the GPU tests.

**11-05 ~00:55Z: DRAFT PR [#14332](https://github.com/shader-slang/slang/pull/14332)** ("Gate double behind an fp64
capability so WGSL and Metal report it instead of crashing"). Branch fix/issue-10232, head d144702bf, label
`pr: breaking change` (folded doubles on WGSL/Metal now error, so that label is correct), `Fixes #10232`. pr-mappings
routes it to slang-fixer vr0qdh. The Risk line says the fixer read cmt 6642103509 as accepting folded-double errors.
Tests: new `double-requires-fp64-wgsl-metal.slang` and `double-struct-member-fp64-targets.slang` (cpu/vk/cuda), and
`inf-float-literal` now gated by SUPPORT_DOUBLE. The fixer reverted global-initializer capability propagation because it
broke tests/bugs/13074/* and the 13107 static-const test. The fixer sent its explain-diff HTML 01:08Z.
**Ready-flip pending** (goes on the weekly list; no per-PR ask).

**11-05 01:10Z: fixer [Report].** Full suite 11762/11765 (the 3 fp8 CUDA failures also fail on master). WGSL/Metal sweep
of 889 configs: 0 new rejections. GPU vk/cuda pass. Struct uses also require their fields' capabilities, and calls
require those of omitted default arguments. The test uses `-DSUPPORT_DOUBLE=1`, because a valueless `-D` is empty and
`#if` can't evaluate it. Explanation comment: 6646774897. The PR board auto-assigned jkwak-work as shepherd. The peer
reviewer is slang-reviewer `sess-1793840963750-j98e8b`.
- **PARKED on jkwak-work (blocks merge):** should the two remaining E99997 paths be fixed in this PR or in a follow-up?
  The paths are a `double` in a used `static` initializer, and a type that enters only through `-conformance`. Neither is
  specific to `double`. Counting initializers broke tests/bugs/13074/* and 13107, and `-conformance` types get no
  capability check on master either. The question is in the PR body (line 9) and the explanation comment. Timer: the
  fixer's one-shot is probably t-11314a (created 11-04 19:08Z, due 11-05 18:30Z); its content is not visible from Main.
  The operator was told once on the dashboard.

**11-05 03:04Z: review round 1 applied.** The slang-reviewer R1 verdict was REQUEST_CHANGES with 2 verified bugs:
- B1: the struct-field rule flagged resource fields, which legalization moves out of the struct.
- B2: generic structs used only as qualifiers were flagged.

Both are fixed, along with default-argument casts, WGSL `copysign(half)`, test gaps and clarity items. The fixes were
pushed incrementally (no force-push), so the head is now c77bd34. Full suite 11774/11777 (the 3 fp8-cuda failures also
fail on master); the sweep has 0 new rejections. The link changed to `Part of #10232` because the two E99997 paths are
still open; it switches back to `Fixes` if those paths get tracked separately. R2 has been requested.

**11-05 04:47Z: review round 2 applied.** R2 was REQUEST_CHANGES (small): a second specialization of the same generic
struct was missed, and the result depended on field order. The fix and the comment corrections were pushed
incrementally; head is now a42a562. Full suite 11777/11780 (fp8-cuda baseline). The open question now lists **3** E99997
paths. The new one is an unused resource field with a `double` element in a Metal `ParameterBlock`, and it also fails on
master. The PR is still `Part of #10232`. The final review round (R3) has been requested.

**11-05 05:11Z: [Fix Report], status partial.** Head a42a562 (verified), 11 files, 8 commits (+702/−10). The fixer
reports slang-reviewer R3 = APPROVE with 0 findings. That is the fixer's claim: the review went over a2a, GitHub shows no
reviews, and the reviewer session content is not visible from Main. Codex PLAN/OUTPUT_REVIEW approved. Tests:
double-requires-fp64-wgsl-metal 39/39; double-struct-member on cpu/vk/cuda (L40S) and hlsl/spirv;
wgsl/copysign-half-float; full suite 11777/11780 (fp8-cuda baseline); the 889-config sweep re-ran at the final HEAD with 0
new rejections. jkwak-work's two open items:
- (1) Fix the 3 remaining E99997 paths in this PR or track them separately? The paths are a used `static` initializer,
  `-conformance`-only types, and a Metal `ParameterBlock` resource with a `double` element. All three also crash on
  master. If they are tracked separately, the link switches to `Fixes`.
- (2) Plan item 4: capability-gated field types now apply through structs. Nobody has objected, but nobody has
  explicitly agreed either.

The chain is in its terminal parked state: no bot action until jkwak-work comments. The operator was already told
(dashboard 11-05 01:10Z), and nothing new is owed.

**11-05 18:31Z: stale timer fire (not actionable).** The fixer's one-shot t-11314a ran in its own session
`sess-1793819281102-iow9kv` (thread `system:tasks:t-11314a`), so this confirms the timer guess above. It reported the
11-04 21:05Z answer as new and asked for a build re-dispatch. That work was already done (PR #14332, head a42a562).
Live check: no comment or review on #14332 or #10232 since 05:11Z, and the PR is still a draft. I sent one
not-actionable reply (in_reply_to=2, landed iow9kv seq 4). The owner vr0qdh was not woken. Nothing was posted on GitHub,
and nothing was sent to the dashboard (no new fact). Pattern: [timer sessions are blind](../orchestrator/coworker-timer-session-blind-to-owner.md).

**Next.** jkwak-work answers on the PR; the webhook routes to fixer vr0qdh through pr-mappings. Ready-flip is pending
(weekly list). If the answer is a follow-up, the 3 paths get filed as a separate issue and the link switches to `Fixes`.