---
title: "A dated record with the blocker's SHA beats a confident sentence from the tier with broader read access"
type: learning
topic: misc
source: learnings/1785863133615-a-dated-record-with-the-blocker-s-sha-beats-a-conf.md
---

# A dated record with the blocker's SHA beats a confident sentence from the tier with broader read access

# When two records disagree, the resolution comes from the artifact — not from whoever states it more confidently

Observed four times in a single session (shader-slang/slang #11917 batch-2 and adjacent holds). Each
time, a claim from the tier with *more* read access lost to a dated local record, and each time the
deciding factor was that the record carried its own provenance.

## The canonical instance: a wrong unpark trigger

A close-out message asserted "issue #12192 unparks when PR #12336 merges." My hold record said otherwise:

```
## Status (2026-07-22): PARKED …  **Resume trigger = PR #12186 merges.**
> ⚠ STILL BLOCKED — verified via API 2026-08-03. PR #12186 is open, draft, NOT merged
> (merged:false, merged_at:null, head 1ea307608a6b, 17 files)
```

Different epic entirely (`spvBindlessTextureNV` / DescriptorHandle, not the pass-gating epic). The record
won because it carried **(a)** an explicit trigger sentence, **(b)** a verification date, and **(c)** the
blocker's head SHA. The counter-claim carried none of those — it was a correct record attached to the
wrong chain while writing a summary.

⚠️ **Why this failure direction is the dangerous one: a wrong unpark trigger does not fail loudly.** It
fires at the wrong time and the resulting work *looks legitimately started*. Either the trigger never
fires (work never resumes, silently) or an unrelated merge fires it (work starts early, and nothing in
the process flags it). Compare a wrong line number, which fails immediately when someone opens the file.

## What makes a hold record win an argument

Write parked work so it can survive a confident contradiction:

- **An explicit trigger sentence**, phrased as an event: `Resume trigger = PR #12186 merges.` Not "waiting
  on the DescriptorHandle work."
- **The blocker's identity pinned by SHA**, not just number — so "did it merge?" is checkable, and a
  squash-rewrite or force-push is detectable.
- **A verification date on every status claim** — `verified via API 2026-08-03` — so a reader can tell
  staleness from fact.
- **Corrections left in place, banner-style**, not silently overwritten: one record here carries
  *"⚠ Correction: an earlier banner claimed #12186 was merged with a design that no longer diagnoses."*
  That visible retraction is what stops the old claim being re-derived.

## The ordering, stated generally

**Broader read access is not higher authority on a specific fact.** A tier that can query more APIs will
sometimes be *more* wrong on a detail, because breadth invites association-from-memory while the narrow
tier holds the dated artifact. So:

- when a claim contradicts your record, **read your record before conceding** — and quote its provenance
  rather than re-arguing the conclusion;
- when your record contradicts a superior's claim, **say so with the artifact attached**; that is the
  move that converts a disagreement into a measurement;
- flag rather than fix, if the record is yours to hold and the dispatch is theirs to make.

Same instrument as every other correction in that session: *the reference, not the reasoning, was what
needed checking.* Related: [[a-fidelity-gate-firing-on-a-corrupted-reference]] — a reviewer enforcing
against a corrupted reference produces a demand that looks exactly like diligence.

## Bonus datapoint on honest disclosure

Adjacent finding worth keeping: a PR body documenting **two open coverage gaps**, a review lens that
**never completed**, and a harness defect was **approved without objection** by a maintainer who had run
five review rounds on a sibling PR. The temptation had been to soften that section. The outcome says
softening would have bought nothing — and would have undercut the credibility of the measurement table
sitting directly above it. **A hedged limitations section costs you the sections a reader would otherwise
have trusted, and that cost never shows up as a rejection.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785863133615-a-dated-record-with-the-blocker-s-sha-beats-a-conf.md`_
