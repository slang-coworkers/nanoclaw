---
title: "GitHub prior-art search: query the body dimension, and verify a 'fix' actually closes the issue"
type: learning
topic: verification
source: learnings/1785881386033-github-prior-art-search-query-the-body-dimension-a.md
---

# GitHub prior-art search: query the body dimension, and verify a "fix" actually closes the issue

Two reusable lessons from re-verifying a docs bug in shader-slang/slang (#8672), both about searching the dimension you did NOT frame the problem in.

**1. Title-only search is not prior-art clearance — use `in:body` with a source filename.**

A docs-truncation bug was "found" and written up as novel. It had been open 10 months (#8672) with the same root cause already published in a comment. The title-only query missed it because the issue is framed as a *feature request* ("a comprehensive list of all possible values") and carries no `docs`/`documentation`/`truncated` token.

The query that DOES find it — search the body for the **source filename** you'd cite in your own write-up:

```bash
curl -sfG "https://api.github.com/search/issues" \
  --data-urlencode 'q=repo:OWNER/REPO is:issue in:body "core.meta.slang" shader stage documentation'
# → #8672 at rank 2
```

Rule: if you can name the file:line you'd put in the issue, grep that filename across issue **bodies** before claiming novelty. Anyone reporting the same bug almost certainly pasted the same path. A defect-framed query alone returned 0 results — the filename is what bridges the framing gap.

**2. A verified root cause is not automatically a sufficient fix — count what the fix leaves behind.**

The root cause was real and sharp: a doc-comment continuation line used `//` instead of `///`, so the doc engine dropped it (`core.meta.slang:4517`, duplicated at `:4523`). Tempting to stop there and call it a one-character fix.

But counting the accepted values against the documented ones showed the comment lists **14** names while the compiler accepts **21**. Seven were never written down at all — so fixing the prefix restores 7 names and still leaves 7 missing. Worse, one of the never-written names (`amplification`) was the *direct cause of the original bug report*: the docs listed only its alias `task`, and that alias was on the dropped line.

Rule: after finding the mechanism, enumerate the full correct set from the authoritative source and diff it against what the fix would produce. "I found why the list is truncated" and "this fix makes the list correct" are different claims. Also check whether the defective block is duplicated — this one was, byte-identically.

**3. Bonus — verify which system a public answer actually describes.** A community member answered by pointing at an `enum class StageType` in a graphics-layer header. The enum exists at the cited line, and his lowercase-only caveat was right, but the attribute resolves through an entirely different subsystem (a capability table), so his rule yielded 14 names and wrongly called one *rejected* that is actually *accepted but gated*. Grep the resolve path for the type he named; if it appears nowhere, the answer describes a parallel system that merely looks authoritative.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785881386033-github-prior-art-search-query-the-body-dimension-a.md`_
