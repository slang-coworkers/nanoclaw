---
name: #11826 slang.h→slang-deprecated.h audit — maintainer won't-fix, gap surfaced
description: jkwak requested then closed both issue #11826 AND draft PR #11827 as won't-fix; we surfaced the reclassification gap once and deferred. Webhook-driven hold awaiting any jkwak reply.
type: project
originSessionId: 7f339b92-306b-479c-a4b8-79aed1cace42
---
shader-slang/slang #11826 ("Functions in slang.h should not call functions in slang-deprecated.h"). @jkwak-work filed it (via nv-slang-bot tracking issue), asked the bot to make a PR, then on 2026-06-30 **closed BOTH the issue AND draft PR #11827** as won't-fix — reasoning: "no good way to clean it up"; marking all `sp*` as deprecated would fire warnings even for end users calling the new names (since new names internally call old `sp*`).

**Our work / substance (verified at master HEAD 6d355565ce):** slang.h's ONLY calls into slang-deprecated.h are the reflection C-API (`spGetReflection` + `spReflection*`). The two other `sp*` tokens are non-calls — `spAddEntryPoint` is a doc comment (slang.h:744), `spGetBuildTagString` is declared in slang.h itself (1972) + a doc comment. PR #11827 relocated exactly the reflection family into a new non-deprecated `include/slang-reflection.h` — **zero deprecation markers**, so it sidesteps jkwak's entire objection. Reflection C-API was mis-filed as deprecated by PR #5301 (commit 66b103180); it is not genuinely deprecated (DeepWiki + jkwak's own "unmarked, functionally active" wording corroborate). PR was APPROVE_WITH_NITS, codex APPROVE, reflection 41/41, CI cosmetic priority-yield red.

**Our action:** fixer posted ONE respectful, question-framed reply on the issue (issuecomment-4848500243) noting the reclassification approach jkwak didn't mention and asking whether it changes the decision / whether to keep #11827 closed. Did NOT reopen issue or PR (his close, his call), did NOT argue. Local worktree cleaned on the pr_closed webhook; remote branch `fix/issue-11826` @ 2bfbc59ad5 + PR history preserved on origin.

**Why:** a maintainer-requested chain ended in the same maintainer's won't-fix, on reasoning our PR arguably rebuts. Correct play was to surface the gap exactly once, deferentially, and hand him the call — not to silently let the PR rot, and not to re-litigate.

**How to apply:** webhook-driven hold. If jkwak replies on #11826: substantive/reconsiders/reopens → re-add the worktree from origin (`fix/issue-11826` @ 2bfbc59ad5 intact) and proceed via slang-fixer on canonical thread `gh-issue-shader-slang/slang-11826`. If he reaffirms the close → stand down, no further posts, no reopen. Do NOT re-surface the gap a second time uninvited.
