---
title: "A backticked issue ref creates no GitHub cross-link — verify by timeline, not body text"
type: learning
topic: verification
source: learnings/1786199088834-a-backticked-issue-ref-creates-no-github-cross-lin.md
---

# A backticked issue ref creates no GitHub cross-link — verify by timeline, not body text

# A `#12378`-style issue ref inside a code span is inert

**Measured 2026-08-08 on shader-slang/slang#12428.** A triage comment stated that a neighbouring
draft PR "is worth cross-linking" and reasoned about it at length. **The cross-link did not exist.**

All four issue refs in the posted body (`` `#11454` ``, `` `#11455` ``, `` `#11520` ``, `` `#12378` ``)
were inside backticks. **A `#N` in a code span produces no link, no timeline event, and no
notification on the target.**

## Evidence + controls

- #12378's timeline: exactly **1** `cross-referenced` event, *"from #12367"* — **not** from #12428,
  across 28 total timeline events.
- #12428's own timeline: `commented`, `issue_type_added`, 4× `labeled`. **Nothing else.**
- **Instrument control:** the same regex applied to #12367's comment `5199718759` finds **1 bare**
  `#12378`, so the pattern does detect bare refs — the zero on #12428 is real, not a broken grep.

## Why this is the DEFAULT failure, not carelessness

Every house-style rule that says "wrap identifiers in code spans" pushes `#12378` into a code span,
because it *looks* like an identifier. **The habit that makes a comment readable is the habit that
silently unlinks it.** Expect this in any well-formatted bot comment, and expect the author to
believe the link exists — the prose ("worth cross-linking") is accurate as a *recommendation* and
nil as an *effect*. That gap is what reads as done.

## The check

Verify a cross-link by the **target's timeline**, never by the source's body text. The body tells
you what someone meant to do; the timeline tells you what GitHub did.

```bash
gh api repos/OWNER/REPO/issues/N/timeline --paginate \
  --jq '.[] | select(.event=="cross-referenced") | "from #\(.source.issue.number)"'
```

To detect the cause in your own draft before posting — count bare vs wrapped refs:

```bash
# bare (will link) vs backticked (inert)
grep -oP '(?<![`])#1[0-9]{4}(?![`])' body.md | wc -l   # want > 0
grep -oP '`#1[0-9]{4}`' body.md | wc -l                 # these link to nothing
```

## Sibling failure worth pairing with it

An **@-mention count of zero** has the same shape: a comment can close with a genuine design
question for a maintainer and notify nobody, on an issue with zero assignees. Same chain, same
comment: the warning-vs-error fork had 0 `@`-mentions. The control is the neighbouring #12367
chain, where the equivalent fork sat until an explicit `@jkwak-work` ask — and the answer to that
ask is what unblocked the work. **An unaddressed question on an unassigned issue is prose, not a
request.**

⇒ Before posting a comment whose purpose is to *reach* someone or *connect* two threads, count the
bare refs and count the mentions. Both are one grep, and both fail silently.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786199088834-a-backticked-issue-ref-creates-no-github-cross-lin.md`_
