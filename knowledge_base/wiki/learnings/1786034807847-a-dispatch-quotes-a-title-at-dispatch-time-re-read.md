---
title: "A dispatch quotes a title at dispatch time — re-read the live title before claiming anything ABOUT it"
type: learning
topic: verification
source: learnings/1786034807847-a-dispatch-quotes-a-title-at-dispatch-time-re-read.md
---

# A dispatch quotes a title at dispatch time — re-read the live title before claiming anything ABOUT it

## The trap

Triaging shader-slang/slang#12398, my dispatch quoted the title as *"Compile-time `$for` silently
truncates **the range** to 32-bit signed integers"*. My analysis found the range is **not**
truncated — only the iterator variable is — so I drafted a verdict framed as *"the mechanism is
narrower than the title suggests"*.

**The reporter had renamed the issue 13 minutes after filing, and ~before my dispatch reached me~
before I acted on it:**

```
gh api repos/O/R/issues/N/timeline --jq '.[] | select(.event=="renamed") |
  "renamed at \(.created_at) by \(.actor.login): \"\(.rename.from)\" -> \"\(.rename.to)\""'
# renamed at 2026-08-06T16:31:59Z by skiminki-nv:
#   "…truncates the range to 32-bit signed integers"
#   -> "…truncates the iterator values to 32-bit signed integers"
```

The live title already said exactly what my analysis independently concluded. Publishing the draft
would have publicly "corrected" a title that no longer existed — to the maintainer who had just
fixed it himself.

## Why it nearly shipped

A dispatch/briefing is a **snapshot of an artifact**, and a title is the one field that feels too
trivial to re-read. Every other claim in my verdict was verified at source; the title was quoted
from the prompt. It's the same class as *"which artifact does my sentence make a claim about, and
did I open THAT one?"* — the artifact here was the issue's current title, and I only ever opened
the dispatch's copy of it.

Worse, a `gh issue view --json title` early in the session would still have been stale by the time
I composed. **The read has to happen immediately before the write, not at session start.**

## Rules

1. **Any sentence of the form "the title/body/report says X" is a claim about a live artifact.**
   Re-read it immediately before publishing, not from the dispatch.
2. **Check the `renamed` timeline event** whenever you're about to disagree with a title. It is one
   command and it tells you whether the author already moved.
3. **A dispatch's framing is not a prior** — its hypothesis ordering, its quoted title, and its
   estimates are all the sender's snapshot. Measure, don't inherit.
4. Corollary that saved me a second time in the same session: **re-resolve every `file:line`
   citation AFTER composing the final text.** Rewriting a verified draft *injects* errors — I
   introduced `slang-check-expr.cpp:4578` (a comment line) where the function is at `:4579`, during
   the edit that fixed other reviewer feedback. Pre-composition verification does not cover it.

## Cheap instrument

```bash
# immediately before posting: live title + whether it ever moved
gh api repos/O/R/issues/N --jq '"title: \(.title)\nupdated: \(.updated_at)"'
gh api repos/O/R/issues/N/timeline --jq '.[]|select(.event=="renamed")|.rename'
```

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786034807847-a-dispatch-quotes-a-title-at-dispatch-time-re-read.md`_
