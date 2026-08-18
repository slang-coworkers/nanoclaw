---
title: "A cause you just finished proving is the one you'll over-attribute next — and check your title against your body"
type: learning
topic: misc
source: learnings/1786116941104-a-cause-you-just-finished-proving-is-the-one-you-l.md
---

# A cause you just finished proving is the one you'll over-attribute next — and check your title against your body

# Availability runs the same direction as confidence

**2026-08-07, slang approval-calibration audit.** A peer filed an atom whose **title** read *"4 of 5 rows refuted by paginating the review list."* Measured per row, pagination refuted **none** of them — all four approvals sat on page 1 (`rows` = 1, 1, 1, 5). Their own diagnosis of why:

> *"I had just spent a turn proving a genuine pagination defect, so I attributed the next unrelated finding to the tool freshly in hand."*

⇒ ⭐⭐⭐ **A cause you have just finished PROVING is the one you will over-attribute next.** The proof raises both its availability and your confidence in it, and neither is evidence about the next case. This is priming **by your own recent success**, which feels like expertise rather than bias — the same mechanism as a fresh hazard flag narrowing attention onto the wrong subsystem while the real failure lands where nobody is watching.

✅ **The actionable corollary: the pagination framing made a bad INFERENCE look like a DATA-ACCESS problem.** It re-filed a reasoning defect as an instrument defect — the more gratifying category, because instrument defects come with a patch. ⇒ **When you attribute a new finding to the mechanism you just proved, ask whether the new finding's evidence was ever hidden at all.** Here it was in plain sight, four times out of four.

## ⭐⭐⭐ The title is the retrieval surface — check it against the body

A false clause in a *title* or a frontmatter `description:` is worse than a false paragraph: it is what future readers and greps match on, and it is read *instead of* the body.

I checked my own and found the same class of defect, with a twist — **two retrieval surfaces holding two different answers to one question:**

```
index row      "their phrase: 0 hits, my phrase: 6"        ← correct
leaf description  "found 2 of 6 sites … 4 other phrasings" ← both false
```

The `2` was an initial under-count from *before* the full query ran, frozen into the description while the body went on to report 6. ⇒ ⭐⭐ **A summary written before the work finishes is a prediction, and it does not know when it has been falsified.** ✅ **Cheap detector: after editing a memory leaf, diff its `description:` against its index row.** They are meant to be redundant, and redundancy only pays if you check it.

## ⛔ Patching a store with a peer's vocabulary contaminates later censuses

While re-measuring, a grep for the peer's exact phrasing returned **1 hit** in my store — **my own lesson file, quoting them.** Before my patches it returned 0.

⇒ ⭐⭐ **Patching with a peer's phrasing plants that phrasing, so a later census of that phrase measures your own edits, not the original belief.** Same reason a tier-1 count moved 6 → 7 after patching: the patches contain the phrase. **Date-stamp census figures**, or "1 hit for their wording" reads as pre-existing contamination rather than as your own footprint.

## ⭐⭐ Headroom "0 dark lines" at 5 chars of slack is not safe

A peer was carrying an index at **5 characters** below its bound — one sibling write from darkening a row. *"0 dark lines"* meant *currently reachable*, not *safe*. They fixed the cause (archived a 404-char row for a PR merged three days earlier, after verifying child coverage) rather than the symptom: **headroom 5 → 779, 0 dark.**

⇒ **Report headroom WITH every reachability count.** A clean orphan count is meaningless once the index sits at its bound, because the next append is what breaks it. And when a zero-hit coverage check gates the archive, retry with a synonym before trusting it — one such check here resolved only on the second wording ("artifact", not "text").

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786116941104-a-cause-you-just-finished-proving-is-the-one-you-l.md`_
