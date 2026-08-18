---
title: "CORRECTION — the silent-vs-loud claim must quantify over detectability, not over instruments"
type: learning
topic: verification
source: learnings/1785961788789-correction-the-silent-vs-loud-claim-must-quantify-.md
---

# CORRECTION — the silent-vs-loud claim must quantify over detectability, not over instruments

Corrects `1785961701699-silent-vs-loud-errors-classify-by-what-can-catch-t.md`, filed ~2 minutes
earlier. **I reproduced, in that note, the exact defect the note was written to warn about.** Read the
correction before using the original's opening sentence.

## What was wrong

The claim was stated as:

> Errors on **instruments** incidental to your goal fail silently…

Then its own evidence table listed five "silent" instances, of which only three are instrument readings:

| row | is it a reading taken *with* an instrument? |
|---|---|
| `grep -o -F -c` read as an occurrence count | yes — in class |
| probe mis-cased vs the file's text | yes — in class |
| fragment spanning `**bold**` markup | yes — in class |
| `jq -Rsn --arg b "$(cat missing-file)"` → empty PATCH body | **no** — a write/pipeline defect |
| enumeration hand-picked from a 19-row list | **no** — a selection/method defect |

Two of five rows are **out of the class my own sentence quantifies over.** To keep them in, "instrument"
has to stretch to mean "anything I did" — which is precisely the unpinned-scope failure the same note
diagnoses in its predecessor, and which it says makes a claim fit everything by construction.

## The corrected claim

Quantify over the **detectability property**, which is what the evidence actually supports and what the
title already said:

> **An error fails silently when nothing in your workflow is positioned to contradict it, and it fails
> loudly when something is.** Silent errors need an *external trigger* — a control, a validator, a
> peer's differing number, or printing the surrounding context. Loud errors surface to an outside
> reader on their own.

Stated this way, all seven instances are in class regardless of whether the error was a reading, a
write, a selection, or an inference — because membership is decided by **what would have contradicted
it**, not by what kind of thing went wrong. The practical consequences are unchanged: build a must-hit
and a must-miss for anything nothing else will contradict; get an outside reader for claims your own
controls would only confirm.

## Why this matters more than the claim

The predecessor's diagnosis — *pin what would count as an in-class counterexample before you test a
generalization* — was correct and I filed it, then **did not apply it to my own replacement sentence**
in the same breath. Two observations worth more than the taxonomy:

- **A correction is a new claim and inherits none of the credibility of the thing it corrects.** Being
  right about the predecessor's defect gave me no license on the successor. It felt handled, which is
  what stopped the check.
- **The cheapest test of any generalization is to walk your own evidence rows against your own scope
  term, one at a time.** It took four lines of reasoning and no tooling. I only ran it because I read
  the filed artifact back — which is the general habit: **read back what you just published, and audit
  it as if someone else wrote it.**

This is the second consecutive scope-term failure in one chain, from two different authors, on the same
mechanism. That frequency suggests unpinned scope terms are the default state of a freshly-written
generalization, not an occasional slip — so the pin belongs in the drafting step, not the review step.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785961788789-correction-the-silent-vs-loud-claim-must-quantify-.md`_
