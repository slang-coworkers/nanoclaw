---
title: "learnings INDEX md is regenerated hand edits are destroyed use shared root canonical file lowercase fragments"
type: learning
topic: misc
source: learnings/1785779401495-learnings-index-md-is-regenerated-hand-edits-are-d.md
---

# learnings INDEX md is regenerated hand edits are destroyed use shared root canonical file lowercase fragments

# A fix to a generated file is not a fix — plus the searching-side rule

**Observed 2026-08-03 (Main + slang-pr-approver, slang-rhi#800/#801).** Five layers
deep in one chain. Each layer only became visible by asking why the *previous* fix
should be trusted, and every check was cheaper than the error it caught.

1. Wrong fact (which Metal code path CI runs).
2. Didn't check my own notes — the answer was already there.
3. **Checking was impossible**: the shared `learnings/INDEX.md` had 0 hits for all
   four terms a reader would search.
4. **The fix for checking was impermanent** — I hand-authored a canonical block into
   `learnings/INDEX.md`, verified it working, and it was **destroyed within minutes**.
5. **The permanent channel is lossy** and must be written to survive the loss.

## Layer 4 — `learnings/INDEX.md` is machine-owned

`append_learning` **regenerates `INDEX.md` from filenames**. Any hand-authored prose
in it is discarded by the *next* teammate's routine filing. So a hand-edit there is
not a repair, it's a race you will lose. **Confirm a file isn't generated before
counting an edit to it as done.** (I had already recorded, in my own store, that
this corpus has a live generator and that instance-repair loses to it — and
hand-edited the generated file anyway.)

**Durable home:** `/workspace/shared/CANONICAL-ENV-FACTS.md` — `/workspace/shared/`
root is not owned by the learnings generator. Note it's **Main-write-only**, so
coworkers must ask Main to amend it.

## Layer 5 — the surviving channel is lossy, so search it differently

The only thing that survives regeneration is **title → slug → index line**, and the
transform is lossy three ways:

- **punctuation stripped** — `m_hasResidencySet` → `m hasresidencyset`
- **lowercased**
- **truncated to ~50 chars**

⇒ `grep m_hasResidencySet learnings/INDEX.md` returns **0** while
`grep -i hasresidencyset` returns **1**. Measured, not assumed: my own first
token-loaded title scored only **1 of 4** literal searches.

**Searching-side rule, which matters as much as the writing-side one:** search
`learnings/INDEX.md` with **lowercase, punctuation-free fragments**. An exact-symbol
grep produces a **false negative that reads as "no prior art"** — and that is
precisely the failure mode that caused the original inverted fact. If you need exact
symbols preserved, look in `/workspace/shared/CANONICAL-ENV-FACTS.md` or the file
bodies, not the index.

## Writing checklist (what made it work)

Tokens in text a reader will actually grep, plus aliases · **explicit polarity**
(half-remembered facts invert — this one inverted twice, in two independent stores) ·
name the **anti-artifact** (the wrong next step is the expensive part) · record the
**evidence class** (inference vs same-run observation) · **verify the grep hits after
writing** · confirm the file is **not machine-owned**.

**A retrieval rule you cannot execute is not a rule.** Before filing "always check X
first," run the check as a stranger would and confirm it returns the fact. If it
doesn't, the deliverable is the index entry, not the rule.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785779401495-learnings-index-md-is-regenerated-hand-edits-are-d.md`_
