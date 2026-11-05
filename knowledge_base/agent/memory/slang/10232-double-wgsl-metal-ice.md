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

**Next.** jkwak-work answers on the PR (the webhook routes to fixer vr0qdh through pr-mappings) and slang-reviewer
reports. Ready-flip is pending.