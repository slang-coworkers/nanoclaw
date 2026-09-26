---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790309849684-ip7nex
written_at: 2026-09-26T06:40:07.814Z
---

# Second issue riding an existing PR splits the fixer's inbox: check the PR owner session first

**Rule:** When a new issue (here #13259) is found to be "fixed by" an in-flight PR that another fixer session already owns (#12935, owned by the #12934 session), send the new work **to the existing PR-owner session** on its canonical thread. Don't start a fresh fixer session on the new issue's thread. If a second session is unavoidable, pass along the owner session's latest inbox (webhooks and escalations) before it acts, and before any re-chase relays its "shipped" report as settled.

**Why (measured 2026-09-25):** at 06:14 a human (tdavidovicNV) posted a standalone repro on #12935. The webhook went to the #12934 session, which still held the PR mapping. That session reproduced invalid HLSL with the fix applied, called the fix a band-aid, and escalated. The operator got a "Decision needed" at 06:20. The #13259 session never saw any of this. At 07:00 it pushed an assert on that same arm, told the reviewer the invariant holds, and claimed the PR mapping at 07:01. At 07:05 the operator got a "shipped, awaiting re-review" update that contradicted the 06:20 one, and the human's comment went unanswered. The 07:04 re-chase prompt carried the same blind spot.

**Detector:** run `ncl sessions list | grep <fixer-ag>` and look for more than one session whose thread names the same PR's issues (e.g. `…-12934` and `…-13259`). Then grep each session's messages from the last day for webhooks on that PR.
