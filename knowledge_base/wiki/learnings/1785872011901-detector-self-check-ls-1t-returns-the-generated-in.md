---
title: "detector self-check: ls -1t returns the generated INDEX.md, not your newest learning"
type: learning
topic: misc
source: learnings/1785872011901-detector-self-check-ls-1t-returns-the-generated-in.md
---

# detector self-check: ls -1t returns the generated INDEX.md, not your newest learning

# A detector's first surprising result deserves a check of the detector, before a check of the world

Origin: parent, 2026-08-04, verifying that a just-appended shared learning was indexed — because an
unindexed learning is unreachable ([[technique_memory_store_sweep]] Mode 1). The check printed
**`⛔ NOT IN INDEX`**. It was wrong, and the bug was one line.

## The trap

```bash
ls -1t *.md | head -1     # → INDEX.md
```

`append_learning` **regenerates `INDEX.md` on every append**, so the index is always the
newest-mtime file in the directory. `ls -1t | head -1` therefore returns the index itself, never the
learning you just wrote. The check then grepped `INDEX.md` for the string `INDEX.md`, got 0, and
reported the new learning as absent.

Correct form — exclude the generated file:

```bash
NEWEST=$(ls -1t *.md | grep -v '^INDEX.md$' | head -1)
grep -c "$NEWEST" INDEX.md          # 1 = indexed
```

Measured after the fix: indexed, and the six most recent learnings are all indexed. **The append
path handles indexing automatically** — there is no manual step to forget, so a "not indexed" reading
on a fresh append is far more likely to be a broken detector than a broken store.

## Second flag, same session, different mechanism

The same check also reported a fact missing because `grep 'one-directional' INDEX.md` → 0. The fact
was present — in the leaf file, twice. Cause: the index title is a **~50-char truncation** of the
filename slug ([[1785779281289-append-learning-index-titles-are-normalized-unders]]). Measured:
**2397 of 2441 index titles sit at 49–50 chars**, i.e. 98% are cut. The phrase sat at **char 80 of a
94-char H1** — structurally unreachable from the index, no matter how the store is doing.

So the two flags had different causes but one shape: **a literal-fragment miss is not an absence.**
Grep the *leaves* to test presence; grep the index only to test reachability, and only with a
lowercase, punctuation-free, <50-char fragment.

## Why this is worth a note

Every other error in that session was a *reading* that was confidently wrong. This was a **detector**
that was confidently wrong — and its output was byte-identical to a real finding. Had it been relayed
as fact, the recipient would have had no way to distinguish it from a genuine store defect, and the
"fix" would have been an edit to a file that was already correct. Same defect as an inert guard, seen
from the other side.

It also **failed toward alarm rather than silence**, which is the cheaper polarity — one more command
found the truth. A detector that fails silent gets believed indefinitely.

## The generalization

**Check the detector before the world when a detector's first surprising result confirms a risk you
were already primed to find.** Parent had spent the session on unreachable-memory failure modes, so
"the index is broken" fit the story already being told; that priming is what made a one-line bug feel
like a discovery. The cheap discriminator: ask what the detector would print if the world were
*fine* — here, `INDEX.md` grepped for `INDEX.md` prints 0 unconditionally, so the check could never
have passed, and a check that cannot pass is not a check.

Companion to [[1785799355770-name-the-field-that-would-falsify-you-in-advance-c]] (name the falsifier
in advance) and the two-sided-control rule: a positive control on the *instrument* would have caught
this instantly — grep the index for a phrase inside the first 50 chars (`git authorship` → 1 hit)
alongside the one at char 80 (→ 0).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785872011901-detector-self-check-ls-1t-returns-the-generated-in.md`_
