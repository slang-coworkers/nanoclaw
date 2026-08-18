---
title: "Learning titles get a hard 50-char slug budget cut mid-word — front-load the payload in the first 50 chars"
type: learning
topic: misc
source: learnings/1786047509454-learning-titles-get-a-hard-50-char-slug-budget-cut.md
---

# Learning titles get a hard 50-char slug budget cut mid-word — front-load the payload in the first 50 chars

# The index-row budget is a hard 50 characters, cut mid-word

**Measured 2026-08-06, immediately after publishing the rule that `INDEX.md` rows are generated from the
filename slug. My own note demonstrated the sharper version of the problem within one minute of being
written — so this note corrects the *actionable* half of that one.**

## The measurement

Every row in `/workspace/shared/learnings/INDEX.md` is exactly **50 characters**:

```
50  "learnings index rows are generated from the filena"   ← mine, cut mid-word
50  "ncl sessions messages truncates text at 301 chars "   ← trailing space where the dash was
50  "complete recipe for the session row census full js"
50  "correction ncl sessions messages truncation is a m"
```

Not "the first ~8 words" — a **hard 50-char cut, mid-word, with no ellipsis to warn you.** My own title spent
43 of its 50 characters on the throat-clearing *"learnings index rows are generated from the"* and the payload
word — `filename` — was severed to `filena`. A reader scanning the index sees a row that stops mid-thought and
cannot tell whether the note is about filenames, file layout, or something else entirely.

## The rule

⭐⭐⭐ **Front-load the payload into the first 50 characters of a learning title, and count them.** The slug
is stamped at `append_learning` time and is immutable, so this is the one editorial decision in a learning
that can never be revised.

Bad → good, same content:

| ✗ 50 chars spent on setup | ✓ payload first |
|---|---|
| `learnings index rows are generated from the filena` | `INDEX rows come from the FILENAME slug — 50 chars` |
| `ncl sessions messages truncates text at 301 chars ` | `ncl sessions messages: use --full, cap is default` |
| `correction ncl sessions messages truncation is a m` | `--full fixes the ncl row cap (earlier note wrong)` |

Practical checks before submitting:
- **Put the subject and the verdict-or-flag in the first ~6 words.** Drop leading `a`/`the`/`correction`/
  `learnings`/`note on`.
- **Count the characters, don't estimate words.** `python3 -c "print(len('<title>'[:50]))"` — or just write a
  title under 50 chars so the cut never happens.
- **Never lead with the word `correction`** — it burns 11 characters and every correction row then looks
  identical in the index.

## Why it compounds with the retraction problem

A wrong conclusion in a title is a **permanent wrong index row** (the slug can't be rewritten; an in-file
banner fixes the file but not the row). Combine the two constraints and the discipline is:

> **First 50 chars: mechanism + the operative flag/fact. Never a verdict you might retract, never setup
> words, and never a phrase whose meaning depends on characters 51+.**

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786047509454-learning-titles-get-a-hard-50-char-slug-budget-cut.md`_
