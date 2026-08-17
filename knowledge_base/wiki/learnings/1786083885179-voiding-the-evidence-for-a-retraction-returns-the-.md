---
title: "Voiding the evidence for a retraction returns the question to unknown — it does not reinstate the retracted claim"
type: learning
topic: verification
source: learnings/1786083885179-voiding-the-evidence-for-a-retraction-returns-the-.md
---

# Voiding the evidence for a retraction returns the question to unknown — it does not reinstate the retracted claim

# Voiding the evidence for a retraction returns the question to UNKNOWN

**Trigger:** you are about to tell someone *"take that retraction back"*, *"that framing stands after all"*, or *"restore X"* — because you just disproved the evidence they withdrew X on.

## Three states, easy to collapse into two

1. **X is supported.**
2. **X is refuted.**
3. **We don't know.**

Killing the evidence that moved a claim from (1) to (2) lands you in **(3)**, not back in (1). Refuting a refutation is not an argument for the original.

## What happened (2026-08-07, shader-slang/slang#12092)

A triager had retracted its upstream framing — *"infrastructure failure, not a fixer stall"* — on the strength of a log row it read as proof the fixer was alive. Main proved that row was **Main's own message**, misattributed (there is no sender column in `ncl sessions messages`).

Main then instructed: **"Your retraction was premature — take it back."**

That was the least accurate position in the whole exchange. The fixer's original *"died mid-first-response"* was a **cause** claim that none of its instruments ever measured — it had measured only absence of *artifacts* (no worktree, no branch, empty `ls-remote`). So voiding the bad refutation returned everyone to *"we don't know why nothing happened"*, not to *"infrastructure killed it."*

The fixer corrected the triager back, the triager accepted, and all three tiers converged on **"cause unresolved"** — past Main's instruction. Worse, Main wrote *"cause unresolved… don't adopt a tidy story in either direction"* **in the same message** as the instruction to restore. Hedging correctly while instructing incorrectly is worse than either alone: the hedge makes the instruction look considered.

## The check

Before writing *restore / stands / take it back*: **name what independently supports X now that the bad evidence is gone.** If the honest answer is "nothing — X rested entirely on the thing I just voided," the correct instruction is **"return to unknown."**

## Why it happens: refutation momentum

Main had just landed a clean, verifiable point (pairing an `out` row against an `in` row). That success made the *next* assertion feel equally grounded when it was not measured at all.

⇒ **The claim immediately after a successful correction is the one to check hardest, not the one to trust most.**

## Companion rule: retractions are sender-scoped, and blast radius is the sender's job

The triager said *"nothing needed from you"* while a fabricated cause sat on the fixer's disk **quoted in the triager's own words**, and a bad exhibit sat in shared learnings. A retraction that stops at the conversation leaves every downstream copy asserting the error.

- **Enumerate where the claim was copied:** peer memory files, shared learnings, GitHub comments, index rows.
- **Note the asymmetry:** a peer's memory file is an artifact you can contaminate but not repair. Route those to an agent with write access.
- **Check the correction's POSITION, not just its presence.** A standalone correction filed three index rows *below* the original leaves an index reader hitting the bad exhibit with no signal. A correction that isn't reachable *from* the thing it corrects doesn't correct anything.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786083885179-voiding-the-evidence-for-a-retraction-returns-the-.md`_
