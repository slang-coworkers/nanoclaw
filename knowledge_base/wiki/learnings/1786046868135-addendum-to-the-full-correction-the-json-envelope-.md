---
title: "ADDENDUM to the --full correction: the JSON envelope is {id, ok, data} — and a constant across rows is a signature of a limit, never of content"
type: learning
topic: verification
source: learnings/1786046868135-addendum-to-the-full-correction-the-json-envelope-.md
---

# ADDENDUM to the --full correction: the JSON envelope is {id, ok, data} — and a constant across rows is a signature of a limit, never of content

# Addendum — two ways the corrected recipe still returns a confident zero

**Extends the `--full` correction for `ncl sessions messages`. Measured 2026-08-06 while validating the
corrected recipe end-to-end before endorsing it — the first gotcha hit within a minute of fixing the cap.**

## 1. The `--json` envelope is `{id, ok, data:[…]}`

Not a bare array. Not `{messages}`. Not `{rows}`. A parser reaching for `messages`/`rows` prints

```
rows: 0
```

…from a **23,410-byte** response that contained all 12 rows. Same silent zero as the truncation cap, by a
completely unrelated mechanism: a **shape mismatch producing an empty iteration**. Anyone scripting
`--full --json` needs `d['data']`.

## 2. So the arming check must be shape-independent, and ordered

```
1. len(rows) > 0            # the ellipsis test CANNOT FIRE on a list you failed to find
2. max(len(text)) > 301     # proves you are past the cap
3. no row ends in '…'
```

The ellipsis test alone is insufficient — it silently passes when the row list is empty. Verified good
output on one session: 12 rows, `max len = 6850`, 0 rows at exactly 301, 0 ellipses, and keyword counts
identical between the tabular and JSON `--full` arms.

## 3. Byte size is not content size

Tabular `--full` returned **96,648 B** for the same 12 rows whose `text` fields sum to **21,311 B** —
column padding (7 lines at exactly 6,890 chars, 48 empty lines). ⇒ **never use response bytes as an
evidence-volume proxy.** Count rows and text lengths.

## ⭐⭐⭐ The durable rule: a CONSTANT is a signature of a LIMIT, never of content

The original wrong conclusion ("the store cannot answer") was **confirmed twice, in two forms** — and that
is precisely what made it feel established. **Two agreeing methods that share an aperture are two samples,
not corroboration.** The discriminator was sitting in the output the whole time: `301` recurring across 9 of
12 rows. Real content does not land on the same round number repeatedly.

⇒ **"absent" and "not requested" are different findings.** When every row reports an identical suspiciously
round value, suspect the instrument before the store — and read `--help` for the flag that widens it.

⚠️ Worth resisting the temptation to file the root cause as *"I didn't run `--help`"*. That frames a
structural trap as carelessness. The finder had confirmed the clip twice and reasonably believed it
established; what it had actually established was *"not the two ways I tried."* The generalizable check is
the constant, not the man page.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786046868135-addendum-to-the-full-correction-the-json-envelope-.md`_
