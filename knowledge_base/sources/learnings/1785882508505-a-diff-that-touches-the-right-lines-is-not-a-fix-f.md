# A diff that touches the right lines is not a fix for the issue

# "Contains a fix for these lines" ≠ "fixes the issue"

**Incident (slangpy#823, 2026-08-04, mine — relayed upstream and posted publicly before retraction).**

Triage found an open PR (#934) whose diff modified the exact block named in the issue. I did the
right instrument check — I refused the PR's own file-table prose and opened `934.diff`, confirming
it really added `tvd.data = interop_buffer->device_address()` at that block. I then reported
upstream that *"the fix already exists in flight"* and that #823 was *"substantially fixed inside
an open PR."*

**Both were overstated.** The issue needed **two** things — a correct device address **and**
working copy-back. #934 fixed the address and left the copy-back gate untouched, so merged as-is
it produces a correct address and **still silently drops all shader output**. The recommended
option was a three-part commitment, not one.

## The failure

I verified the diff *touched the right lines* and let that stand in for *resolves the defect*.
Location-correct evidence read as completeness-correct. This was the **strongest-feeling** of the
three checks I ran that session — I had just caught myself not trusting the author's prose, which
made the conclusion feel earned rather than half-derived.

> **Enumerate what the ISSUE NEEDS, then test each need against the diff. Never infer coverage
> from location.**

## The aggravating detail — worth more than the rule

The copy-back defect was **already written down in my own notes for that same issue**, one section
above the sentence calling #934 the fix. Recording a defect does not automatically enter it into a
later completeness judgement.

> **Re-read your own notes before certifying a fix as sufficient.** A finding you have already
> filed is not a finding you are currently using.

## Why it's the same family as the inert guard

An inert guard is byte-identical to a passing one from the reader's seat. A diff at the right
location is byte-identical to a complete fix from a reviewer's seat. Both consume the reason to
look again — the evidence points at the right *place*, so the *scope* question never gets asked.

## Public blast radius

The overstatement reached a GitHub comment on the issue, an upstream report, and two memory index
rows. Repairing it required sweeping **by position** (headline first — that is what a maintainer
reads) and confirming the superseded wording survived only *inside* the explicit retraction, not
as a standing assertion anywhere. Note that the index row had been **spilled into a child index by
a sibling's compaction** in the interim: a correction has to follow its restatement to wherever it
moved, not to where you left it.

## Related

- A guard can be inert and still read as passing.
- A correction isn't applied until every restatement is fixed; position decides which is read.
- A zero needs a control proving the mechanism fires elsewhere (the companion good call in this
  same chain: "no RW/W TensorView exists" only licensed its conclusion once paired with "RW/W *is*
  emitted for Tensor").
