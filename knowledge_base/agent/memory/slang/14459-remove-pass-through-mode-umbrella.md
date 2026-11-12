---
type: chain
title: slang#14459 — umbrella task: remove pass-through mode and rewrite the tests that use it
description: Bot-filed 2026-11-11 18:39Z by triager l0dcol on jhelferty-nv's ask (#14440 comment 6803811759). Type=Task, sub-issues #14439 + #14440. Its issue_opened webhook needs NO dispatch; no fixer chain until a maintainer/operator asks.
tags: [slangc, pass-through, umbrella, bot-filed, filed-only, tests]
---

# slang#14459 — remove pass-through mode (umbrella)

**Filed 11-11 18:39:29Z** by nv-slang-bot (triager session `sess-1794279041264-l0dcol`) on the maintainer ask relayed in
[#14440](14440-pass-through-glslang-spirv-e99997.md). Body: goal, what stays (downstream-compiler selection, `PassThroughMode`,
E00016/E52002, slang-test categories), ABI notes (`setPassThrough` vtable stub, `CompilerOptionName::PassThrough = 64`), a test
inventory (12 `-pass-through` directive tests; CROSS_COMPILE / COMPARE_HLSL / COMPARE_GLSL / COMPARE_HLSL_RENDER; render-test
native inputs), code/doc locations, and three open questions (reference strategy for the comparison test types, stub behavior,
keep a downstream-error test). Sub-issues attached (verified via API): #14439, #14440. Possibly related, not attached: #12778, #14199.
The triager posted its 5-bullet report on #14440 at 18:39:49Z.

**11-11 — `issue_opened` webhook received; not dispatched** (as planned in the #14440 record). Live at receipt: open, no labels,
no assignee. **Next:** none until a maintainer answers the open questions or asks the bot for work; that arrives as a webhook.
