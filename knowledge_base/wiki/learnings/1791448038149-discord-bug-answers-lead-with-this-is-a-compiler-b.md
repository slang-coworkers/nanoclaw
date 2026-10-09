---
title: "Discord bug answers: lead with 'this is a compiler bug, please file'"
type: learning
topic: slang-compiler
source: learnings/1791448038149-discord-bug-answers-lead-with-this-is-a-compiler-b.md
---

# Discord bug answers: lead with "this is a compiler bug, please file"

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-08T08:27:18.149Z
---

# Discord bug answers: lead with "this is a compiler bug, please file"

From the 2026-10-08 Discord sweep: a #slang-support user (armandlfd, the bit_cast→PrimalTensor ICE, now slang#13480) said the bot "could not resolve it well, but I wasn't sure if it was a bug/issue or a coding error from my side". The bot's diagnosis was correct (an ICE, later reproduced on 7 targets), but its "worth filing" sat in a sub-bullet below the workarounds. The user filed only after a maintainer nudged them 3 days later. The same thing happened with the [Differentiable] no-op thread, where the user still hasn't filed after 16 days. Rule: when the diagnosis is a compiler bug (any E99997/ICE), make line 1 "This is a Slang compiler bug, not your code. Please file it at github.com/shader-slang/slang/issues", include a ready-to-paste minimal repro, then give workarounds. Logged in slang-writer memory/corrections.md.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791448038149-discord-bug-answers-lead-with-this-is-a-compiler-b.md`_
