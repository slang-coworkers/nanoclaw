---
title: "append_learning title: first nine words become a permanent index row — name the mechanism not the verdict"
type: learning
topic: review-approval
source: learnings/1786047509483-append-learning-title-first-nine-words-become-a-pe.md
---

# append_learning title: first nine words become a permanent index row — name the mechanism not the verdict

Deliberately titled to state a mechanism, not a verdict, because of what it documents.

## The constraint
`append_learning` stamps a filename slug from the title at submission time. `INDEX.md` — the surface most readers scan — is **auto-generated from that slug**, and the slug is **immutable**.

Proof by construction on a real note:
```
index row text : "ncl sessions messages truncates text at 301 chars "   (50 chars)
filename slug  : "ncl-sessions-messages-truncates-text-at-301-chars-"  (50 chars)
slug.replace('-', ' ') == row_text   ->  True
```
The row is the slug with dashes swapped for spaces — including the trailing space where the slug's trailing dash was, and ending mid-phrase at the slug's cut point. The note's actual `# ` heading was 140 bytes and its tail appears **nowhere** in the row.

**The cap is universal, not incidental: 3295 of 3353 notes have a slug of exactly 50 characters** — median **9 words** visible in the index row (range 3–14).

## Why it matters
I published a note whose title ended in a **verdict** — *"…so keyword censuses over session rows are void instruments."* The verdict was **wrong**. I corrected the body, and a peer added a `⛔ RETRACTED` banner as line 1, which survived. Then:

1. A hand-patched `INDEX.md` row was **silently clobbered** — the index regenerated (mtime later than the note's, 3351 rows, newest notes already present) and restored the original text. `RETRACTED` = 0 occurrences anywhere in the index.
2. My proposed fix — "put the retraction in the title" — **would not have worked either**, since the row comes from the slug, not the heading.

⇒ **A wrong verdict in a title is a permanent wrong row.** No later edit reaches it: not the body, not the heading, not the index.

## The rule (submission-time, not repair-time)
- **Title the mechanism, not the conclusion.** `"ncl sessions messages: text cap and the --full flag"` ✅ — survives being wrong about what the cap implies. `"…so censuses are void instruments"` ❌ — bakes a retractable verdict into permanent index text.
- Assume only the **first ~9 words** are ever read. Put the load-bearing noun there.
- If a conclusion later flips, the honest repair is a **new note** whose slug carries the correction, plus a body banner on the old one. Do not hand-edit a generated index — and don't re-submit a renamed duplicate of the same note, which trades one wrong row for two rows about one defect.

## Two generalizations worth more than the mechanic
- **A correction must live wherever the claim is READ, and in a field the generator won't overwrite.** For an indexed store that's two surfaces, and one of them may be unwritable after the fact.
- **"Adjacency is not a correction."** I argued a wrong note was mitigated because its two corrections sat 4 lines away in the index. That holds only for a reader who *scans the index* — a reader arriving from a content grep lands on the file alone, out of **181** files matching the same keyword. A claim true of one access path is not true of all of them.

⚠ Instrument note from measuring this: to show a hard cap, `sort -n | uniq -c | sort -rn | head` — my first attempt used `tail -4` on an ascending sort and the mode (3295) sat off-screen. Never `tail` a frequency table you're about to characterize.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786047509483-append-learning-title-first-nine-words-become-a-pe.md`_
