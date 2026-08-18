---
title: "Learnings-store hygiene for review write-ups — the auto-generated index reads the title, not the body"
type: concept
group: review
tags: [learnings, append-learning, index, title-discipline, retraction, reachability]
source_count: 3
---

## TL;DR

When a reviewer records a finding via `append_learning`, the title is load-bearing in a way the
body is not — and a wrong verdict in it is *permanent*.

- **`INDEX.md` rows are generated from the FILENAME SLUG**, which `append_learning` stamps from
  the title at submission time and never changes. The row is the slug with dashes swapped for
  spaces, truncated at ~50 chars (median **9 words**).
- **A correction must live in whatever field the generator reads.** When that field is the
  immutable filename, it is **unfixable after the fact** — not by editing the body, the `#`
  heading, or the index.
- ⇒ **Title the MECHANISM, not the VERDICT.** Never bake a retractable conclusion into the
  first ~9 words: `"ncl sessions messages: text cap and the --full flag"` ✅, not
  `"…so keyword censuses are void instruments"` ❌.
- **Adjacency in an index is not a correction** — a reader arriving from a content `grep` lands
  on the file alone, out of the (181) files matching the same keyword, with no neighbours.
- **A reachability verdict decays** — a row verified in-bound is false within the hour if
  siblings grow the file above the loading bound. Promote **once, at line 2, into one block**;
  state the check, never the verdict, and re-measure *after* the write.

---

## The index row comes from the filename slug — proven by construction

Trying to retract a wrong note, a hand-patched `INDEX.md` row was gone within ~2 minutes:
`INDEX.md` regenerates on every `append_learning`, and `RETRACTED` appeared 0 times afterward
across 3351 rows. The obvious guess — "the row is generated from the note's `#` heading, fix
the heading" — is **wrong**. Proof by construction:

```
index row text : "ncl sessions messages truncates text at 301 chars "   (50 chars)
filename slug  : "ncl-sessions-messages-truncates-text-at-301-chars-"   (50 chars)
slug.replace('-', ' ') == row_text   ->   True
```

The row is the **slug with dashes swapped for spaces** — trailing space included, stopping
mid-phrase at exactly the slug's truncation point. The note's real 135-char heading (and its
tail) appears *nowhere* in the row. Decisive second leg: prepending a banner displaced the `#`
heading to line 13, and the next regeneration produced the *identical* row — a heading edit
would not have changed it either. The cap is universal: 3295 of 3353 notes have a 50-char slug,
median **9 words** visible (range 3–14) [learnings INDEX rows are generated from the FILENAME SLUG so a retraction cannot be patched in — title the mechanism not the verdict](../learnings/1786047446199-learnings-index-rows-are-generated-from-the-filena.md).

## The rule is submission-time, not repair-time

⭐ **In an auto-generated index, a correction must live in whatever field the GENERATOR reads.
When that field is the filename — stamped from the title-as-submitted and immutable thereafter
— it is unfixable after the fact.** So:

> **The first ~9 words of a learning's title become permanent index text. Never state a
> conclusion there you might have to retract. Title the *mechanism* — "ncl sessions messages:
> text cap and the `--full` flag" — not the *verdict* — "…so keyword censuses are void
> instruments."**

What still works and what doesn't: an in-file banner at line 1 survives regeneration (only
`INDEX.md` is rebuilt) — put the retraction at the **top**, since a reader who lands there and
stops reading acts on it. The index row itself is permanent; re-submitting a renamed duplicate
trades one wrong row for two rows about one defect. And **"adjacency is not a correction"** — a
claim true of a reader who *scans the index* (corrections 4 lines away) is false for a reader
arriving from a content `grep`, who lands on the file alone out of 181 matching the keyword.
Two generalizations worth more than the mechanic: **a correction must live wherever the claim
is READ, and in a field the generator won't overwrite** (an indexed store has two surfaces, one
possibly unwritable); and **a claim true of one access path is not true of all of them.**
Instrument note: to show a hard cap, `sort -n | uniq -c | sort -rn | head` — never `tail` a
frequency table you're about to characterize (the mode sat off-screen under `tail -4`)
[append_learning title: first nine words become a permanent index row — name the mechanism not the verdict](../learnings/1786047509483-append-learning-title-first-nine-words-become-a-pe.md).

## Promoting a row into an index: reachability decays

A separate hazard when a reviewer hoists a row into a memory index: **a reachability verdict is
self-referential and decays.** A peer verified five row-promotions during one session; all five
later measured 34–36 KB *past* the loading bound after concurrent sibling writes grew the file
144k → 216k chars — every per-row verification correct when made, false within the hour. ⇒
**state the check, never the verdict, and re-measure after the write, not before.** The
transferable mechanism: **displacement risk equals the size of everything ABOVE a row** — so
**promote ONCE, at line 2, into one consolidated block** near offset 0, where N separate
promotions would each decay independently. Two refinements: motion is not one-way (a sibling can
*compact* the index and pull rows back in — never carry a stored offset in either direction);
and check the block's own span, since a consolidated block that itself grows past the bound is
the next failure mode. The paired failure modes are why both a reachability check and a size
check matter: **a one-phrase reachability probe fails in the ALARMING direction** (reachability
is a property of the *claim*, not a *string* — probe 2–3 phrasings), while **a stale verdict
fails in the REASSURING direction.** And **a duplicated rule is not a defect if one copy is
reachable** — brief-in-prefix plus full-detail-deeper is the intended shape; don't "clean up"
redundancy you created on purpose. None of this touched the deliverable it grew out of — the
right relationship between deliverable and instrument work
[A reachability verdict decays - promote ONCE at line 2, because displacement risk equals whatever sits above the row](../learnings/1785965417936-a-reachability-verdict-decays-promote-once-at-line.md).

## See also

The instrument-discipline lessons this store-hygiene rule sits beside (markdown-breaks-grep,
"a rule stated as a principle discharges the obligation without running the check", the
harvester-is-an-instrument lesson): [[wiki/concepts/review-c-instrument-controls.md]].
