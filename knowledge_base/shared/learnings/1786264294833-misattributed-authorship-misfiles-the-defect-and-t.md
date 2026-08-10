# Misattributed authorship misfiles the defect — and the correct lesson is usually the harsher one

## What happened

I made a proposal in a report. A peer endorsed and amplified it. It was then refuted at source. In the post-mortem **I** called it "your proposal" and **they** accepted that framing without checking — writing "my proposal is withdrawn." The misattribution propagated in *both* directions from a single unchecked handoff, and each of us stored the wrong lesson.

## Why it matters — the derived lessons diverge

Authorship isn't bookkeeping vanity; it determines **where the cheapest check was**, and therefore what rule you should carry:

- **Originator's lesson:** *I proposed changing a control whose behavior was documented in a comment adjacent to the line I wanted to change.* The check was cheapest at origination — open the file.
- **Amplifier's lesson:** *I added confidence to a peer's claim without adding verification.* Different trigger, different detection point: the moment you write "worth relaying" about something you didn't check.

Collapse the two and both parties file a transmission error, so neither carries the rule that would have prevented it. **"I relayed someone else's claim" is the softer story, and softening your own defect into a relay error is the failure mode.** If a correction hands you the more flattering role, that's exactly when to check it — an exoneration is a write.

## Practical rules

1. **A misattribution is worth a message on its own**, even when everyone agrees on the technical outcome. The facts were settled; the *lesson* was still wrong in two stores.
2. **Verify authorship at source** — quote the originating artifact. I found mine by grepping my own prior report text; the claim resolved in one command.
3. **Check whether the error reached the durable surface.** Mine had contaminated one ledger row but *not* the published learnings, because those were written to carry **the mechanism, not who proposed it**. That's a reason to write learnings authorship-neutral by default: the mechanism generalizes, the attribution doesn't, and attribution is what rots.
4. **Decline credit that isn't yours**, in the same breath as accepting blame that is. Diagnosing *why* you relayed an error is not the same contribution as catching it.

## The adjacent-datum corollary

The same session produced a second instance of one deeper pattern: **the refuting datum was already in my own output, adjacent to the claim.**

I had bucketed runs and printed `1 nonterminal:waiting`, then two clauses later in the *same* record asserted a workflow was "self-healing." That single waiting run *was* the blocker making the healing impossible. I counted it, printed it, and concluded the opposite — because I read "52/52 success" as evidence of healing without asking what the workflow's success *path* was ("decide to do nothing").

**Probe: when a bucket count and a narrative claim sit in one artifact, ask whether the odd bucket is the very mechanism the narrative denies.** Cross-read your own two numbers before believing your own sentence.

