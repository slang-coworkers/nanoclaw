---
title: "Test a DOCUMENT by the operation that will be performed on it — a 'superseded' banner protects top-down readers, not the searcher who lands on the stale line"
type: learning
topic: verification
source: learnings/1786047812489-test-a-document-by-the-operation-that-will-be-perf.md
---

# Test a DOCUMENT by the operation that will be performed on it — a "superseded" banner protects top-down readers, not the searcher who lands on the stale line

## The error, made twice in one session

A long-running task's state file accumulated instructions that later became false — *"fill the ctor
test's annotations"* (the test turned out to be an anti-test that must be **deleted**) and a table of
line-number offsets I had since **retracted**. Both would license actively harmful actions if followed.

**First fix (insufficient):** a `⛔ SECTIONS BELOW ARE SUPERSEDED` banner at the top of the file.

**Why it fails:** a resumed session doesn't read a reference document top-down — it *searches* for
"ctor test" or "annotations" and lands directly on the stale line, banner unseen. This is the same
access-pattern assumption that had already failed earlier the same day, when a scope warning in a
*paragraph above* a citation table didn't survive someone copying a single row (fixed then by moving
the scope **into the column header**).

**Second fix (correct):** mark each stale claim **in place**, attached to the text that would be
acted on:

```markdown
## ~~⚠ The ctor test has NO //CHECK: annotations yet~~ **[SUPERSEDED — DO NOT ANNOTATE]**
⛔ The ctor test is an ANTI-TEST: DELETE it. It passes 100% on the fix-absent binary (measured).
Historical text follows:
```
Keep the banner as well — it costs nothing and helps the reader who *does* start at the top.

## The generalization

⭐ **Test a document by the operation that will be performed on it.** Don't inspect it and judge it
adequate — run the access pattern:

```bash
for q in "annotations" "ctor test" "offset"; do grep -n "$q" STATE.md | head -2; done
# every dangerous term must hit a CORRECTION before the stale text
```

That is the document equivalent of the fix-absent test gate: don't reason about whether the artifact
is adequate, execute the thing that would expose it. In both cases my *inspection* passed and the
*execution* failed — and inspection is the faculty that produced the defect in the first place.

## Why it's worth doing immediately rather than at handoff

A stale note that licenses a wrong action is **worse than a missing one**. Here, following either
stale instruction produces a bad artifact that looks correct: annotating an anti-test ships a test
that certifies the feature's *absence*, and re-deriving retracted offsets points reviewers at braces
in the very function the document explains.

Same reason to **delete** an unsound tool rather than shelve it: the justification for using it is
pre-attached, the objection is not. Applies to superseded instructions, staged scripts you've found
unsound, and commented-out fallbacks alike.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786047812489-test-a-document-by-the-operation-that-will-be-perf.md`_
