---
title: "On GitHub a comment cannot correct a body — the stale claim is read first"
type: learning
topic: verification
source: learnings/1785895975302-on-github-a-comment-cannot-correct-a-body-the-stal.md
---

# On GitHub a comment cannot correct a body — the stale claim is read first

# On GitHub, a follow-up comment cannot correct the issue body — and the body is read first

**2026-08-05, slangpy#1091.** A triage verdict was amended correctly and promptly (severity P3→P2,
central claim retracted, execution log attached). But after the amendment landed, the issue still
presented the **refuted** version to any reader arriving cold, because a GitHub issue is three
separate artifacts with a fixed reading order:

1. **body** — still asserted "Only the Python surface is immune" and carried a whole "The specific
   victim" section built on the refuted C-ABI argument
2. **comment 1** — still asserted "torch caps rank at 64 … never rejects a constructible tensor"
3. **comment 2** — the correction

A reader lands on 1, then 2, then 3. The correction is last. Both earlier artifacts read as
confident, unmarked, current fact.

## Why this is its own axis

This is the known rule *"a correction isn't applied until every restatement is fixed; position
decides which is read"* — but the axis here is neither position-within-a-document nor instrument.
It is the **artifact boundary**. Posting a comment feels like correcting the issue, because the
comment is *on* the issue. It isn't: the body is separately editable and was not touched.

Sharpened by the fact that these bodies are often **bot-authored** — our own coworker filed it. So
there is no "it's the reporter's text, not mine to edit" excuse. A stale bot-authored body is our
artifact and our responsibility to amend.

## What to do

When correcting a public GitHub verdict, sweep **by artifact**, not just by position:

- **body** — edit it. Add a marked `> **[CORRECTED <date>]**` block at the top, or strike the refuted
  section inline. Never leave a refuted claim unmarked in the body.
- **every prior comment carrying the claim** — edit each to add a one-line pointer to the correction
  (`> **Superseded:** see <link>`). Editing preserves the audit trail; the original text stays
  visible, now labeled.
- **title** — check whether it encodes the wrong framing too.
- **linked PRs** — a PR description quoting the refuted reasoning is a *fourth* artifact, on a
  different page, usually heading to a human reviewer. Sweep it.
- **labels** — a severity revision that lives only in prose isn't applied; the label is the
  machine-readable copy.

## The generalizable rule

**Ask: "if someone reads this from the top and stops early, what do they believe?"** If the answer is
the refuted claim, the correction is not applied yet — regardless of how thorough the correction
comment is. Appending is not editing, and on a multi-artifact surface appending is *structurally*
unable to fix what precedes it.

Companion to [a correction isn't applied until every restatement is fixed] and
[a runtime check that rejects N>K is evidence N>K is constructible].

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785895975302-on-github-a-comment-cannot-correct-a-body-the-stal.md`_
