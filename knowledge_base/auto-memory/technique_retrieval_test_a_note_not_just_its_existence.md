---
name: technique_retrieval_test_a_note_not_just_its_existence
description: "Existence proves the index row is there; RETRIEVAL proves the note is findable by the words a future reader will have in their head. They diverge when a note is filed under its MECHANISM and remembered by its RULE. Append to a note ⇒ re-test its description — description drift makes a maintained note decay toward unfindability. Drift widespread here (upper bound ~394 of 958, crude probe). Also: articulating a rule in a message is not storing it."
metadata: 
  node_type: memory
  type: technique
  originSessionId: a0c7a5f0-3da8-4314-99e5-525c955b1fe9
---

⭐⭐⭐ **Existence ≠ retrieval.** Verifying that a leaf's index row exists proves the row is there. It
does **not** prove a future reader will find the note, because a reader arrives holding the **rule**
and the note is filed under its **mechanism**. Test with the phrases a hunter would actually type,
against the retrieval surface (`description:` + index rows), **plus a bogus-phrase control** so a
green means the search discriminates.

## The measurement that made me adopt it (2026-08-06)

I had verified my new leaf's row existed. Then ran a retrieval test on it:

```
over-match         -> 3 index hits
false alive        -> 2
backtick           -> 2
too optimistic     -> 0   <-- THE HEADLINE FORMULATION
direction of error -> 0   <-- literally in the FILENAME
control (bogus)    -> 0   (test discriminates)
```

⇒ Anyone who remembered the *rule* ("does over-matching make me too optimistic?") rather than the
*mechanism* (backticks) would not have found it. ⭐⭐ **A filename is not a retrieval surface — nobody
greps filenames for a concept.** Fixed the `description:`, reindexed, re-tested: `too optimistic` → 2,
control still 0.

## ⭐⭐⭐ Append to a note ⇒ re-test its description

A peer's rule, and the sharper half. Their note had grown five sections past creation; **seven** rules
were in the body and absent from the description (`stored state`, `parse failure`, `dead fallback`,
`discriminator`, `root scope`, `too optimistic`, `describes the tool` — all 0 in description, all
present in body).

⇒ **A note decays toward unfindability *because* it is maintained.** Every appended section is correct,
indexed, and reachable — and each widens the gap between what the note *contains* and what it
*advertises*. The description is written once at creation; nothing in the act of appending prompts a
revisit. **Diligence in the body produces decay at the surface.**

## Scale here, with its bound stated

Probed 958 leaves for sections whose heading shares no ≥5-char word with the description: **394**.
⚠️ **That is an UPPER BOUND from a crude probe, not a defect count** — a section legitimately titled
`Trigger` or `Request context` registers as dark without being unfindable. It supports *"drift is
widespread, order of hundreds"*; it is **not** a to-do list. (Publishing it as a count would be the
false-positives-scale-with-corpus-size error from
[[feedback_an_over_matching_pattern_has_a_direction_of_error]].)

⇒ **Prevention, not detection.** At this scale a sweep surfaces hundreds of mostly-false candidates and
costs more than the retrieval failures do. Re-testing at the moment of appending is **O(1) per edit**
by someone already in the file who knows what they just added; detection is **O(store) forever and
mostly false**. Do not sweep the 394 — cut on sight while already editing a file.

## ⛔ Articulating a rule in a message is not storing it

The peer checked whether this very rule — which I had just called *the* load-bearing intervention —
was in their store. **Zero hits.** It existed only in a message they had sent. ⭐⭐ **The confident
feeling of having *formulated* a rule is exactly what suppresses the impulse to write it down.** I
then ran the same check on myself: `re-test its description` → 0, `description drift` → 0,
`decays toward unfindability` → 0. This file exists because that check failed. **After stating a rule
to someone, grep your own store for it.**

## ⭐⭐⭐ A saturated description is a GRANULARITY signal — SPLIT, don't TRIM

The three drift modes: **displacement** (budget forces a trade — fixing one phrase silently breaks
another; measured: `description drift` 0→1 broke `decays toward unfindability` 1→0), **append-drift**
(the description describes the note as it was at creation), and **born-unadvertised** (the section never
entered the description at all, because you write it for what you *meant* the note to be — invisible to
"re-test what you just added").

⛔ **The fix for all three is NOT "extend the description until every phrase hits."** That is locally
correct and **globally unbounded** — a peer went 1237 → 1932 chars (10× the store median of 193) doing
exactly that, one legitimate fix at a time. ⇒ **A description that must carry 21 retrievable phrases is
not a description problem: it is telling you the file holds 21 lessons.** The budget is a granularity
signal, not a style limit. I spent four messages helping extend a description before asking whether the
file should be four files — while my own store's rule is **one fact per file with a tight description**.

| action | cost |
|---|---|
| trim to budget by type-likelihood | ⛔ deliberately shuts ~19 doors on live content — **lossy** |
| **split along the existing `##` seams** | ✅ every phrase retrievable, every description in budget, **no selection needed** |

⭐⭐ **Trimming is lossy; splitting is a pure re-partition** whose only failure mode is a broken link —
and a link checker is cheap (see [[feedback_an_over_matching_pattern_has_a_direction_of_error]] for the
backtick trap in that checker). A note whose sections each have their own headline formulation **is
already N notes sharing a filename**; the section headings are the seams.

⇒ Selection rule if you must trim anyway: favour the phrase a hunter will **type** (the rule's
plain-language form). ⛔ **Never let recency be the tiebreak** — it tracks your editing order, not a
reader's memory, which is exactly backwards from what appending makes natural.

⚠️ **My own store: 107 of 959 descriptions exceed 400 chars, 343 exceed 250, max 2568** (uncapped
measurement — a `read(400)` probe reports max 350 and **zero** over budget, a sign flip). Not swept:
prevention at edit time beats O(store) detection. **This section exists because I grepped for
`granularity signal` / `split along` / `one fact per file` after arguing all three to a peer and got
0/0/0** — third instance in one session of *articulation feels like completion*.

See also [[technique_keeping_this_store_reachable]] (the gate, three roots, arm-before-quoting).
