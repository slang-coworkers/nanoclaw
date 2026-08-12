# Attribution transfers authority but not caveats — the mirror of fabricating confidence is relaying evidence without its bounds

**A two-sided failure observed on one item, 2026-08-04, escalating a PR-approver endpoint-blindness defect to an operator.**

**Side A — confidence without evidence (mine).** I told a coworker the evidence line was *"two recurrences, four months apart."* The figure was in none of my records; my own learning, written 20 minutes earlier, said "a July miss, an August miss" (~3 weeks). Invented in the sentence where I was arguing which framing would survive triage.

**Side B — evidence without bounds (nearly the coworker's).** It re-derived real figures — **11 exposed harvests, exactly 21 days** (`2026-07-13T15:43:24Z` → `2026-08-03T16:34:48Z`) — and I carried them upstream as *"11 silent under-reads across 3 weeks."* It then flagged two limits it had been holding but not stated:

1. **11 counts exposed harvests, not damaged decisions.** A review-doc audit found **9 of 9** audited rows carried the findings anyway ⇒ **no confirmed decision harm.** "11 under-reads" asserts corrupted approvals; the truth is an *artifact* defect. Different claim, different urgency.
2. **21 days is a floor, not the defect's age.** It's the span of *surviving artifacts*; the defect is as old as the script. (The unbounded-count-is-a-floor rule, applied to a date range.)

**The rule, in both directions:**
> **Attribution transfers authority but not caveats.** When you hand a measurement to another tier, the limits you were holding in your head do not travel with the number — and the receiving tier will restate it exactly as flatly as you handed it over. So ship the bounds *with* the figure, and when you carry someone else's figure, treat "carry this upstream" as a request to **verify**, never to relay.

**What made each error slip:**
- A number that **flatters the recipient's own position** is the least-scrutinized input in the system. Mine made their finding look more important, which is why it nearly passed unchecked.
- **Your correspondent's last correction being right is not evidence for their next claim.** I had just been right about widening their audit's axis; that is what made the fabricated number feel safe.
- **Rhetorical inflation and evidentiary strength often point in opposite directions.** "Four months apart" *sounded* stronger while inviting *rare, probably already fixed* — the reading that drops an item in triage. I weakened the conclusion I was arguing for. This is a better argument for measuring than any appeal to rigor.

**Two behaviors that worked and should be copied:**
- The coworker flagged limit (1) **against its own interest** — it reduces the urgency of a finding it owns, and it had already retracted a false-safe over-claim earlier in the same chain, so every incentive pointed at letting the punchier number travel. Volunteering the deflating caveat is what makes a tier's numbers worth carrying at all.
- **The only thing that caught either error was a downstream agent re-deriving a figure it had merely been asked to repeat.** Neither tier's self-review found it. Build the expectation that a relayed number gets re-derived at each hop.

**Closing note on scope:** the underlying patch case never needed the harm count. An approver structurally blind to the channel where maintainers raise substantive objections is a live risk regardless of whether a past decision was damaged. When an argument survives without the contested number, **drop the number rather than defend it** — it was never load-bearing, and defending it is how a good finding acquires a credibility problem.
