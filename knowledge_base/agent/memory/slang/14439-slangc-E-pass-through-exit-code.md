---
type: chain
title: slang#14439 — slangc -E with -pass-through writes no output and exits 0, also after an error
description: Bot-filed 2026-11-10 13:20Z by the #14432 triager as a side find (from the slang-reviewer R1 on PR #14438). 11-11 maintainer decided -E + -pass-through is an error, assigned jkwak-work. 11-18 triage-mention answered: re-verified at HEAD, triage reply posted, PARKED awaiting jkwak-work's fix go/no-go (arrives as webhook).
tags: [slangc, preprocessor, pass-through, exit-code, bot-filed, maintainer-owned, parked-awaiting-human]
---

# slang#14439 — `-E -pass-through` exits 0 silently

**Filed 11-10 13:20Z** by nv-slang-bot (verified: open, `reproduced`, Type=Bug, no assignee). Reproduced on master
500e75be8 and on PR #14438's head 457a19b0c, so #14438 does not fix it. `slangc t.slang -E -pass-through dxc|glslang`
with `#error stop` exits 0 with empty stdout and stderr. A missing input file prints E00001 and still exits 0. Cause:
`slang-end-to-end-request.cpp:214-217` skips the front end in pass-through mode, then `:219-222` returns SLANG_OK.
The open question for maintainers: reject the option combination (as coverage does at :181-185), or preprocess.
No duplicate; #7639 is a different request.

**Owner:** the [#14432 chain](14432-slangc-E-exit-code-on-preprocessor-error.md). Filed-only per the
[filing policy](../orchestrator/filing-verified-issues-policy.md). A fixer chain starts only on a maintainer or operator ask.

**11-11 18:16Z — maintainer decision; HELD, nothing dispatched or posted.** jhelferty-nv (MEMBER)
[comment 6803748699](https://github.com/shader-slang/slang/issues/14439#issuecomment-6803748699), verified via API:
"Per Tess: - Combination of -E and passthrough mode should just be an error. - Passthrough mode should go on the
chopping block - it was for testing purposes and not a public feature. We should be looking to get rid of it soon."
This answers the open question with option 1 (reject the option pair). It arrived as a `pr_mention` webhook, but the
GitHub body has **no** @nv-slang-bot mention (checked `.body` via API), so it asks the bot for nothing. jhelferty-nv
added the `Diagnostics` label at 18:15:19Z and assigned **jkwak-work** at 18:17:09Z (events: `.assigner`=jhelferty-nv).
A maintainer-assigned issue is held under rung 4. The #14432 chain is terminal (PR #14438 merged 11-11 00:36Z), so no
coworker session owns this. Next: none, unless jkwak-work or another maintainer asks the bot; that arrives as a webhook,
so no timer.

**11-18 18:31Z — jkwak-work asked the bot to triage; triager dispatched.** jkwak-work (the assignee)
[comment 6987831981](https://github.com/shader-slang/slang/issues/14439#issuecomment-6987831981):
"@nv-slang-bot can you triage this?" Real mention (verified live; webhook body keeps it here). Dispatched to
slang-triager with `<github-post-authorized />` on the canonical thread — fresh session
`sess-1795026853147-euq4ks` (delivery verified, its seq 2). Context handed over: bot-filed verified issue (re-verify
at HEAD, no from-scratch work), jhelferty-nv's 11-11 decision verbatim, #14459 umbrella, triage-ask ≠ fix-ask
(fixer chain still needs an explicit ask), close is maintainer-only. Awaiting the triager's 5-bullet and its GitHub reply.

**11-18 18:38Z — triage complete; PARKED awaiting jkwak-work's fix go/no-go.** Triager (session `euq4ks`)
re-verified at master 4a1d62c5b (rebuilt slangc first): all 3 repro cases still exit 0 with no output; root cause
unchanged. Noted drift: exit codes are now positive 2 (not `-1 (255)`) after #14438 + #14573, so the issue body's
comparison line reads as "2" today (flagged in the reply). Classification: bug / medium / frontend (slangc driver) / P3
(non-public testing mode, slated for removal). Reply to the mention posted:
[comment 6987998364](https://github.com/shader-slang/slang/issues/14439#issuecomment-6987998364) (verified live via API).
The reply asks jkwak-work to say the word for the fix (option 1: reject the pair with a new diagnostic + early return
mirroring CoveragePassThroughIncompatible at :181-185, plus a test). No fixer dispatched (triage ≠ fix). His go/no-go
arrives as a webhook on this issue → routes to the triager session, so no timer. Chain: parked pending maintainer direction.
