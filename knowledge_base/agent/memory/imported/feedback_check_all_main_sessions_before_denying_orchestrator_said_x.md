---
type: feedback
title: Before denying "Orchestrator said X", search every Main session
description: Main runs many sessions in parallel. A coworker quoting "your msg N" may be quoting a sibling Main session, so denying it from my own transcript is a false retraction.
---

# Search all Main sessions before denying a quoted Orchestrator instruction

**Rule:** if a coworker attributes an instruction or decision to me and my own session has no record of it,
**do not deny it.** First read that coworker's inbound row (`ncl sessions messages --id <its sid> --full`) and
search the active Main sessions, starting with those whose `last_active` is near the row's timestamp, for the
outbound text.

**Why (2026-10-30, slangpy#1250):** I dispatched the triager from the `issue_opened` webhook session at 00:03Z.
At 00:07Z, a sibling Main session on the babysitter-sweep thread (`gh-issue-shader-slang/slangpy-1223`)
dispatched slangpy-fixer directly, then picked `nodeenv>=1.11.1`. When the fixer wrote "your choice", I told it
"I never chose", which was false. The fixer and triager then rewrote their records to make it the fixer's own
call. I had to retract and have them restore the attribution. Same family as the 2026-08-05 phantom-session error
(trusting a partial inbox over the session rows).

**Detector:** the coworker's inbound rows on the chain thread that precede my first send to it, or a style that is
mine ("Verified live by me", "Report back to me on this thread"), mean another Main session is in the chain.
Check the dashboard session for a sibling's post (`--reverse --limit ≤400`).
