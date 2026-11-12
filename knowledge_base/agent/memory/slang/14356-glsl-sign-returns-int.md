---
type: chain
title: slang#14356 — GLSL input `sign()` on float returns int, so `sign(x)/2` uses integer division
description: "Bot-filed 11-05 18:07Z by slang-triager, a side finding of the #13676 triage. Silent wrong result in GLSL-input mode. HELD: maintainer-owned (jkwak-work self-assigned 11-06); operator fixer ask retired 11-11."
---

# slang#14356

**Origin.** A side finding of the [#13676 triage](13676-spirv-sign-float-int-float-roundtrip.md) (10-15). It sat
unfiled as "operator decision (2)" until the 10-31 [filing rule](../orchestrator/filing-verified-issues-policy.md)
retired that decision. Main re-reproduced it on 11-05 and dispatched `slang-triager` (msg 9) to file it.

**11-05 18:07Z, filed by `slang-triager` [Report] (msg 16).** The triager reports re-reproducing on master `4a6758601`
with an incremental Release build. The SPIR-V is FSign → `OpConvertFToS %int` → `OpSDiv %int` → ConvertSToF at -O0 and
at the default level; the vec2 and double forms are affected too. The GLSL output is `float((int(sign(x))) / 2)`. On the
L40S under Vulkan, x=-3 gives 0 (expected -0.5). The cause: `glsl.meta.slang` has no `sign`, so the HLSL int-returning
overload (hlsl.meta.slang ~:15912/15939/15971) wins. Existing glsl-intrinsic tests miss it because
`genFType(0) == sign(...)` passes through the int→float conversion. Dedupe: 10 issue and 3 PR searches found nothing
(#602, #7738 and #3362 are older and closed).
- Main-verified at 18:1xZ: OPEN, author `nv-slang-bot[bot]`, labels `GLSL` + `reproduced`, Type Bug, no assignee, no
  milestone, 0 comments. The body has no @-mentions and no closing link; it cites #13676 as plain text.

**Disposition: filed-only, no fixer chain.** slang-fixer had 22 sessions active since 11-04. Starting a fixer is the
operator's call; asked once on `orchestrator-dashboard` 11-05, default hold. Its `issue_opened` webhook is owned here,
so it needs no dispatch.

**11-05 18:07Z `issue_opened` webhook** landed in Main session `sess-1793902035147-vaunlo` (thread `gh-issue-shader-slang/slang-14356`). Live read at 18:1xZ: still no assignee, 0 comments. Sibling session `sess-1793901687560-orbm9v` had already verified it and asked the operator (dashboard, 18:09Z), so there was no dispatch.

**Resumes on:** the operator's GO, a maintainer comment or self-assignment (then hold under rung 4), or a PR cross-reference.

**11-06 22:07Z: jkwak-work self-assigned** (events API: actor = assignee = assigner = jkwak-work). The issue is now
maintainer-owned, so it is held under rung 4 and the 11-05 operator ask (start a fixer?) is **retired**. The operator
never answered it. A bot PR goes up only if the assignee asks for one.

**11-11 19:02Z, `pr_mention` webhook: jhelferty-nv (MEMBER) comment
[6804720568](https://github.com/shader-slang/slang/issues/14356#issuecomment-6804720568).** The live body matches the payload
and has not been edited. It addresses `@jkwak-work`, **not the bot** (nothing was stripped from the front of it):
*"Per Tess, we need to be carefull with this issue because HLSL and GLSL define the sign() function to return different
types. … A fix for this needs to involve different definitions of sign, depending on which dialect you're using."*
This is maintainer-to-maintainer design direction. It agrees with the filed "possible fix", which is a GLSL-only
overload in `glsl.meta.slang` that leaves the HLSL `int` return as it is. **Held: no dispatch and no bot post.** I sent
the operator one line that withdraws the 11-05 ask. Seen from Main session `sess-1793902035147-vaunlo`.

**Resumes on:** the assignee (jkwak-work) asking the bot for something, a PR cross-reference, or the issue closing.
