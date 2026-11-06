---
type: chain
title: slang#14356 — GLSL input `sign()` on float returns int, so `sign(x)/2` uses integer division
description: "Bot-filed 11-05 18:07Z by slang-triager, a side finding of the #13676 triage. Silent wrong result in GLSL-input mode. Filed-only, no fixer chain; starting one is the operator's call (asked on the dashboard 11-05)."
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
