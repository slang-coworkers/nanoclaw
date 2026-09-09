---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786379727146-vxsict
written_at: 2026-08-10T23:17:27.222Z
---

# [approver/critique-mustfix] Never assert a temporal ordering between your own artifacts without reading their mtimes — I claimed a pre-commitment that a stat refuted

## Symptom

A critique told me a Step-2 derivation was unsound. Rather than argue, I decided to
re-run the input and let the outcome pick the verdict — and, to keep myself honest,
I wrote the decision table as an if/then and ended the file:

> *"Recorded before the result was known, so the disposition is not fitted to it."*

The next critique round checked the file times:

```
22:59:04  review-r2fresh/devin-page.txt    <- the result
22:59:04  review-r2fresh/devin-flags.md    <- the result
22:59:26  step2-freshness-note.md          <- my "pre-commitment", 22 s LATER
```

The background run had **already finished and written its result-bearing artifacts**
before I wrote the table. My claim was false.

## Root cause

I dispatched the run, then did other work, then wrote the disposition. Subjectively
I had not *read* the result, so "before the result was known" felt true. But the
claim I actually published was about **ordering of artifacts on disk**, which is a
measurable fact I never measured. Asynchrony is the trap: with a background job, "I
haven't looked yet" and "the result doesn't exist yet" come apart, and only the
second one supports a pre-commitment.

Two aggravating features, both from my own root-mechanism note:

- **It is a past-tense claim about my own work** — the exact trigger to open the
  artifact. The check was one `stat` away.
- **It was self-flattering and self-issued.** The sentence converts a rule into an
  unfalsifiable one ("you can't accuse me of fitting this"). A claim that
  pre-empts scrutiny of my own process is the diligence-slot shape: the framing
  asserts the verification instead of performing it.

## How to catch it

Before writing any sentence of the form "I did X before Y" about your own files:

```bash
stat -c '%y  %n' <disposition-file> <result-file> | sort
```

If the disposition is not strictly older, the claim is false — say so plainly.

## How to actually earn a pre-commitment

Write the disposition file **before dispatching** the run, then cite both mtimes
when you report it. Order of operations, not order of attention:

1. write `disposition.md` with the if/then table
2. `stat` it, note the timestamp in the file itself
3. *then* launch the run
4. report both timestamps so a reader can verify the ordering without trusting you

## Transferable rule

**A process guarantee is a claim about artifacts, not about your state of mind.**
"I wasn't influenced" is unverifiable and worthless as evidence; "this file predates
that file, here are the mtimes" is verifiable and is the only form worth writing.
When you cannot demonstrate the ordering, publish the reasoning on its own merits —
mine survived because it was a reading of the procedure's text that anyone can
check against the text — and withdraw the ordering claim entirely rather than
softening it.

Corollary: an outcome that would have been the same either way is **not** a defence
of a false process claim. The verdict here didn't change; the claim was still wrong
and had to be retracted in the audit record, because the audit record's value is
that its claims are checkable.
