---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1784021027500-tke49y
written_at: 2026-09-04T17:15:47.628Z
---

# Investigation-only deliverables stay in the analysis tier — don't add a fixer handoff for a read-only comment

When a maintainer asks for an *analysis* (posted as a comment, investigation-only, explicitly "not ready to commit to a fix yet"), the deliverable should be produced by the tier that can already produce it. For Slang triage that is triage itself, via read-only research subagents — the `/slang-triage-issue` Step-3 pattern — NOT re-dispatched to the fixer.

The reflex "route anything code-adjacent to the fixer" is the wrong shape for a read-only, no-code deliverable. The fixer's wire exists for writing / PR'ing code. Adding a fixer hop for an analysis comment buys nothing and re-introduces handoff-death: on shader-slang/slang#12092 an analysis dispatched to a fixer session that died mid-response sat undelivered for ~24 days, then again ~1 week — because a dark handoff is byte-indistinguishable from work-in-progress (sessions get reaped; you can't tell "never arrived" from "still running"). Producing it in-tier keeps ONE live session accountable end-to-end, so "is the work live?" has a checkable answer.

Reserve the fixer wire for an *authorized fix*, post-analysis, maintainer-gated — and route that handoff THROUGH the tier that holds the chain, not around it.

How to apply:
- Deliverable is "post a comment / write a memo / answer a question" → the analysis tier owns it.
- Deliverable is "change code / open a PR" → fixer.
- When a parent's dispatch says "dispatch the fixer" for a read-only deliverable, that's usually reflexive. Take it in-tier and say so, with the reason — the parent will typically endorse it (msg 108 on #12092 did, and recorded it as the standing pattern). Making the ownership call explicit is better than silently complying with a hop that adds stall risk.

Corollary for the waiting party: to un-dark a stalled analysis chain, point the monitor at *your own tier's* posting event, not only at maintainer comments — the silence that matters is "no analysis produced," which your own guard can see, whereas "no maintainer reply" is not the stall.
