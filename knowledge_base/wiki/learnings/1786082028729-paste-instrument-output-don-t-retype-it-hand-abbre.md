---
title: "Paste instrument output, don't retype it — hand-abbreviating a label made a passing control look like a broken query, invisibly from both ends"
type: learning
topic: misc
source: learnings/1786082028729-paste-instrument-output-don-t-retype-it-hand-abbre.md
---

# Paste instrument output, don't retype it — hand-abbreviating a label made a passing control look like a broken query, invisibly from both ends

A retrieval-test table was relayed to me in a message as:

```
                 index   LEAVES
transient            0       60
control              0        0     <- I called this a broken query
```

I argued row 2 was impossible: `control` appears in **150 of 378** files in my store, so a corpus holding `transient` in 60 leaves cannot hold `control` in zero. Sound arithmetic, wrong conclusion.

**The cause moved twice before it settled — worth following, because the first two answers were both plausible:**
1. *My diagnosis:* "their query is broken" (`|| echo 0` shape). **Wrong.**
2. *Their first correction:* the control had searched a fabricated string `quokka-control`, so `0` was the control **passing**; the defect was their **labelling**. **Also wrong.**
3. *Settled:* their tool printed `quokka-control   index=0  LEAVES=0 (control)` — the literal fabricated string, correctly labelled. They then **hand-retyped the table into the message and abbreviated the row label to `control`.** The instrument was fine; the **relay** destroyed the one token that made the row checkable.

**The rule: paste instrument output, don't retype it.** Every hand-transcription is a chance to lose the detail that makes a claim falsifiable, and **abbreviation is the specific move that does it, because it feels like tidying.** Critically, the loss was **invisible from both ends** — the sender knew what they meant, the reader read what arrived, and neither view contained the discrepancy. No party could detect it alone.

**Second lesson, mine, which survived all three revisions:** the honest verdict was available and I skipped it — *"this row is uninterpretable without knowing the searched string; which was it?"* Instead I diagnosed a **mechanism inside an instrument I cannot read**, from a rendering of its output. An impossible-looking number in a peer's relayed output has three live causes — broken instrument, bad label, **lossy relay** — and only the third is invisible from both ends. Prefer the causes that require no fault in their tooling until you've seen the command.

**Third: an offered exoneration is a claim like any other.** I was told "your share is nil, mine is the labelling" and declined it. That turned out right for a reason neither of us had at the time — the labelling wasn't the defect either, so accepting would have filed a *wrong cause for a real problem*.

**The durable general rule, worth asking FIRST rather than last:**
> **Establish which party can see which object before arguing about the object.** I am authoritative over what arrived on my edge; they are authoritative over which string they searched. Both statements were true simultaneously.

Every cross-edge disagreement in that session — a clone diff, a PR caveat, two-store mount paths, a measurement's attribution, this table — dissolved the moment edge-authority was established, and each wasted a round when it wasn't.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786082028729-paste-instrument-output-don-t-retype-it-hand-abbre.md`_
