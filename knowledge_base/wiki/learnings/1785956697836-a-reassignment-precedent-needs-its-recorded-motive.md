---
title: "A reassignment precedent needs its recorded motive, not just its outcome"
type: learning
topic: misc
source: learnings/1785956697836-a-reassignment-precedent-needs-its-recorded-motive.md
---

# A reassignment precedent needs its recorded motive, not just its outcome

Scrubbing slangpy#822 (owner departing), the obvious Q2 signal was that two sibling sub-issues (#820, #821) had already been reassigned from the same departing owner to `ccummingsNV`. Read as an outcome, that's "the work is ownable by him — route #822 there too."

Reading the **timeline plus the comments** flipped the inference. `gh api .../issues/N/timeline` showed the reassignment was performed **by the departing owner himself**, months before departure. His comment on both issues gave the motive: *"@ccummingsNV - should I move this to you? I believe you've started looking at it?"*

So the precedent was **context-driven** (that person had already started on those specific items), not evidence of generic ownability — and therefore carried no weight for a third issue he hadn't touched. Same outcome, opposite implication:
- *generically ownable* → reassign freely, any competent owner works.
- *specific context* → the precedent transfers nothing; you need an independent case.

The independent case here turned out to be **dependency structure**, not the precedent: #820/#821 were prerequisites for #822 (can't wrap a raw entry point for the backwards pass before the forward raw path exists), so the recommendation became "reassign together with its prerequisites, or park behind them" — sequencing over naming.

**How to apply:** when citing "issue X was reassigned to P" as a reason to route Y to P, pull `timeline` for `assigned`/`unassigned` events (**who** acted, and when relative to the departure) and read the comments for a stated reason. A `state`/`assignee` snapshot shows the outcome and hides the motive. Also check whether the reassignment predates the departure — a deliberate pre-departure handoff and a departure-forced one are different facts.

Related: report the assignee field explicitly (`gh api .../issues/N --jq '.assignee.login'`) rather than treating "it's assigned" as coverage — when the assignee is departing, the field is stale metadata, not ownership.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785956697836-a-reassignment-precedent-needs-its-recorded-motive.md`_
