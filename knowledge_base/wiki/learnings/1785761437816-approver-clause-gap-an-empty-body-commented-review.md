---
title: "[approver/clause-gap] An empty-body COMMENTED review is a wrapper, not silence — the substance lives on the inline-comments endpoint"
type: learning
topic: review-approval
source: learnings/1785761437816-approver-clause-gap-an-empty-body-commented-review.md
---

# [approver/clause-gap] An empty-body COMMENTED review is a wrapper, not silence — the substance lives on the inline-comments endpoint

## Symptom

On shader-slang/slang#12080 a supervisor tick flagged "szihs commented at 11:48Z and we haven't
responded." Checking the reviews endpoint showed that review — and several others — with an **empty
body**. Two opposite wrong conclusions were each one step away:

- **"Empty body ⇒ nothing was said ⇒ retract the nudge."** Wrong: the author was mid-burst and had
  written four substantial technical replies.
- **"A maintainer spoke ⇒ our approval is in question ⇒ re-decide."** Also wrong: the text was the
  author answering *bot* findings, not a re-review request.

Both readings came from querying one surface and treating its emptiness as the whole answer.

## Root cause

GitHub models a review as a **wrapper** that *contains* inline comments. Submit a batch of inline
comments without top-level prose and you get:

- `GET /repos/{o}/{r}/pulls/{n}/reviews` → a `COMMENTED` review with `body: ""`
- `GET /repos/{o}/{r}/pulls/{n}/comments` → the actual text, each with `path`, `line`,
  `in_reply_to_id`

Same event, same timestamp, two endpoints — and the one most people query first (`/reviews`) is the
one that looks empty. On #12080 the 11:48:35Z / 11:48:36Z / 12:25:46Z entries were empty-bodied
`COMMENTED` wrappers **and** carried multi-paragraph inline bodies, simultaneously. Neither
observation contradicts the other.

Third surface, easy to forget: `/issues/{n}/comments` holds PR *conversation* comments. On #12080 its
count was unchanged (9) across the whole burst, so polling only that endpoint showed a silent PR
while ~250 review comments accumulated.

## How to catch it

**The discriminator is "is there text on any surface", not "is the newest event non-empty."** Before
concluding a human said nothing, check all three:

1. `/pulls/{n}/reviews` — wrapper state (`APPROVED` / `CHANGES_REQUESTED` / `COMMENTED`) — this is
   where the **verdict** lives, and an empty body here is normal
2. `/pulls/{n}/comments` — inline review text — this is where the **substance** usually lives
3. `/issues/{n}/comments` — PR conversation text

Then classify by **audience and content**, not by author or recency: an author replying to bot
findings is informational; a reviewer raising a new objection is actionable. `in_reply_to_id`
pointing at a bot comment is the cheap tell.

Also paginate. On #12080 the inline comments spanned 3 pages and the relevant author replies were on
page 3 in ascending order; page 1 was entirely July bot traffic.

## Fix

Two rules, one per direction of the error:

- **Empty body ≠ silence.** Resolve a review wrapper to its inline comments before treating a PR as
  quiet. An empty `COMMENTED` wrapper is the *expected* shape for an inline-only batch.
- **Text ≠ actionable.** Read who it addresses. Author-answers-bot is informational and must not
  re-arm a decision procedure; reviewer-raises-objection must.

Cheap summary: **an empty wrapper means "look one level down," never "nothing happened."**

Related failure mode this composes with: summarizing tools will happily paraphrase these bodies. When
a claim is load-bearing (here: *"`SLANG_ASSERT` expands to `SLANG_ASSUME` in release, so asserting
before a conservative `return false` would license the optimizer to delete the fallback"* — verified
true at `source/core/slang-common.h:372`, guarded by `#ifdef _DEBUG` at `:364`), fetch the body
**verbatim** and check the claim against source. That one detail inverted the meaning of the whole
review thread.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785761437816-approver-clause-gap-an-empty-body-commented-review.md`_
