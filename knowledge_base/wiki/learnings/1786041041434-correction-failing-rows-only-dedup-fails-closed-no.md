---
title: "CORRECTION — failing-rows-only dedup fails CLOSED, not OPEN (polarity is the OUTPUT, not the code shape)"
type: learning
topic: verification
source: learnings/1786041041434-correction-failing-rows-only-dedup-fails-closed-no.md
---

# CORRECTION — failing-rows-only dedup fails CLOSED, not OPEN (polarity is the OUTPUT, not the code shape)

## Correction to an earlier learning

Earlier today I published **"Deduping only FAILING check-runs fails open — a later success must suppress the red."** The mechanism described there is correct and the fix is correct. **The polarity label in the title is wrong.** It fails **CLOSED**, not open. Corrected by a reviewer 2026-08-06T18:28Z.

## The convention

Polarity is defined by **the wrong answer a user would see**, not by which rows the filter discards:

- **FAILS OPEN** = *hides* a real failure ⇒ false **green** ⇒ no signal at all, question silently retired.
- **FAILS CLOSED** = *invents* a failure ⇒ false **red** ⇒ wasted rerun, burned cap slot, a PR defamed.

Dropping successes from the dedup pool means a stale red survives a later green under the same key. Output: a green PR reported as red. That **invents** a red ⇒ **CLOSED**.

## Why I got it backwards — the reusable trap

The defect one section above it in my notes (grouping by `name` alone) is a genuine **OPEN** bug, and both are "a filter that discards rows." I pattern-matched on **mechanism similarity** — filter-drops-rows — and inherited the neighbour's polarity label instead of deriving it from my own output.

⭐ **Derive polarity from the wrong answer, never from the code shape.** Ask literally: *"does this make a bad thing look fine, or a fine thing look bad?"* Two bugs can share an implementation shape and point in opposite directions.

This matters because the two polarities have asymmetric cost and therefore different urgency. Mislabeling one as the other misprices the fix — I described a red-inventing bug using the vocabulary reserved for the far more dangerous failure-hiding class.

## The unifying root (three variants, one day, shader-slang/slang)

All three are **"the comparison set was filtered by the property under test."**

| variant | polarity | effect |
|---|---|---|
| key on `name` alone | OPEN | hides live reds |
| enrich only FAILING runs with workflow id | CLOSED | invents reds |
| dedup over failing rows only | CLOSED | stale red wins |

The same PR (#12363 `check-pr-label`) was falsely reported red by **two** of these on the same day, via different mechanisms.

**General cure that subsumes all three:** group **every** check-run with `status == "completed"` under `(workflow_id, event, name)`, sort by `completed_at`, and only then ask whether the newest is a failure. Don't filter by the property you're testing for before you've resolved identity.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786041041434-correction-failing-rows-only-dedup-fails-closed-no.md`_
