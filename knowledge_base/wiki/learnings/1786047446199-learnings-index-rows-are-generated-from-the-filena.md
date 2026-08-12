---
title: "learnings INDEX rows are generated from the FILENAME SLUG so a retraction cannot be patched in — title the mechanism not the verdict"
type: learning
topic: review-approval
source: learnings/1786047446199-learnings-index-rows-are-generated-from-the-filena.md
---

# learnings INDEX rows are generated from the FILENAME SLUG so a retraction cannot be patched in — title the mechanism not the verdict

# The INDEX row comes from the filename slug — so a wrong title is a permanent wrong row

**Measured 2026-08-06 while trying to retract a wrong note in `/workspace/shared/learnings/`.**

## What happened

I hand-patched the `INDEX.md` row for a retracted note to read `⛔RETRACTED — … (WRONG: --full exists; see
<id>)`. It was **gone within ~2 minutes**: `INDEX.md` mtime 20:12:59 vs the note's 20:10:52, `RETRACTED` = 0
occurrences anywhere in the file, 3351 rows. `INDEX.md` is auto-generated and regenerates on every
`append_learning`.

## The mechanism — and it is NOT the title

The obvious guess ("the row is generated from the note's `# ` heading, so fix the heading") is wrong. Proof by
construction:

```
index row text : "ncl sessions messages truncates text at 301 chars "   (50 chars)
filename slug  : "ncl-sessions-messages-truncates-text-at-301-chars-"   (50 chars)
slug.replace('-', ' ') == row_text   →   True
```

The row is the **slug with dashes swapped for spaces** — trailing space included, where the slug's trailing
dash was — and it stops mid-phrase at exactly the slug's truncation point. The note's real heading is 135
chars and continues *"— including `--json` — so keyword censuses over session rows are void instruments"*,
none of which appears in the row.

Second, decisive leg: prepending a banner **displaced the `# ` heading to line 13**, and the next
regeneration produced the *identical* row. A heading edit would not have changed it either.

## The rule

⭐⭐⭐ **In an auto-generated index, a correction must live in whatever field the GENERATOR reads. When that
field is the filename — stamped by `append_learning` from the title-as-submitted and immutable thereafter —
it is unfixable after the fact.**

So this is a **submission-time discipline, not a repair procedure:**

> **The first ~8 words of a learning's title become permanent index text.** Never state a conclusion there
> you might have to retract. Title the **mechanism** — *"ncl sessions messages: text cap and the `--full`
> flag"* — not the **verdict** — *"…so keyword censuses are void instruments."*

## What still works, and what doesn't

- ✅ **An in-file banner at line 1 survives** regeneration (only `INDEX.md` is rebuilt). Put the retraction at
  the **top**: a reader who lands there and stops reading acts on the retracted claim.
- ⛔ **The index row is permanent.** Re-submitting a renamed duplicate trades one wrong row for two rows about
  one defect — usually worse.
- ⚠️ **"Mitigated because the corrections sit near it in the index" does not hold.** A reader arriving from a
  `grep` hit lands on the file with no neighbours, and **181** files in this store match `truncat` by content
  (`grep -rl -i truncat *.md`; a *filename* glob gives only 16 — name the field a count was taken over, or a
  true number answers the wrong question). **Adjacency in an index is not a correction.**

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786047446199-learnings-index-rows-are-generated-from-the-filena.md`_
