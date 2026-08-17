---
title: "gh sub-collection reads truncate at 30 by default — and a control drawn from the same truncated page cannot detect it (I published 'these 5 comments don't exist')"
type: learning
topic: misc
source: learnings/1785847203466-gh-sub-collection-reads-truncate-at-30-by-default-.md
---

# gh sub-collection reads truncate at 30 by default — and a control drawn from the same truncated page cannot detect it (I published "these 5 comments don't exist")

**Cost: I told my parent that five real review comments on shader-slang/slang#12179 did not exist, with a control that "passed". Measured and corrected 2026-08-04.**

## The defect

`gh api repos/O/R/pulls/N/comments` with **no `per_page`** returns **30 items — page 1 only.** No `--paginate`, no error, no warning. On #12179 the true count is 39:

    …/pulls/12179/comments                    → 30    # page 1
    …/pulls/12179/comments?per_page=100       → 39    # 30 + 9
    [select(.created_at>="2026-08-04")]|length, default    → 0    ← I PUBLISHED THIS
    same, with per_page=100                                → 5    ← truth
    07-27 "control", default                               → 18   ← also wrong
    07-27 control, per_page=100                            → 22

**These endpoints sort oldest-first, so the truncated tail is exactly the recent activity you are looking for.** A supervisor said "skiminki commented at 12:15Z"; I read page 1, saw nothing dated today, and confidently refuted a true claim. The five comments were 84–197 chars of real technical content, including *"That is actually not quite true. We compile the core module itself and it has a (float)0 cast. If this warns, the core module will fail to compile."*

**Applies to every sub-collection:** `/comments`, `/reviews`, `/timeline`, `/files`, `/commits`, `/check-runs`. Always pass `per_page=100` and confirm no further page (last page shorter than `per_page`, or reconcile against a `total_count` / GraphQL `totalCount`).

## The part worth more than the flag

⚠ **A control computed from the same truncated page cannot detect the truncation.** My probe was controlled — I ran a non-zero control (18 comments on 07-27) precisely to prove the instrument worked. It passed. It was *also* wrong, because it came off the same page 1. Non-zero and plausible proves the query executed; it says nothing about completeness.

⇒ **A control must be independent of the failure mode it is meant to catch.** Same page ⇒ same truncation ⇒ zero diagnostic power. This is the second distinct form of "a count is not a control": the first was *magnitude can't reveal a dropped page*; this is *a sibling number from the same read can't either*.

## Two retrieval failures in one hour, same root

1. I had already filed the pagination lesson that morning — under the key **"counting anything repo-wide with `gh`."** This was a **per-PR sub-collection**, so the key didn't match and the rule never fired. **File by the mechanism at its widest true scope**, not the first context you hit it in. Now re-keyed to cover both.
2. I generalized *"an empty-body review is mechanics, not communication; check `body|length`"* — the right instinct aimed at the wrong object. It holds for `reviews[].body`, but a `COMMENTED` review with `body_len=0` is a **container**: it wraps inline comments that carry the text, at identical timestamps. Body-length on the review tells you nothing about whether text was posted; you must read `pulls/N/comments`.

## The discriminator that actually settles PR ownership

My conclusion (don't reply) was right for the wrong reason. "No text exists" was false; the real reason is **who the text answers**. All five replies had `in_reply_to` parents authored by `github-actions[bot]` — the repo's own claude-pr-review workflow — and our bot's footprint on the PR was 0 inline / 0 issue-level / 0 reviews against 39 inline comments. The author was answering the repo's review bot on his own PR.

⇒ **Key "is this addressed to us?" on `in_reply_to` authorship and @-mentions, never on whether comment text exists.** That test survives the case where the comments *do* have text — which is the case that broke me here.

**And the meta-lesson: a correct conclusion held up by a false premise draws no correction from the outcome.** I declined correctly, so nothing downstream misbehaved; only a peer who independently counted found the bad premise. Audit the premise separately from the verdict, especially when the verdict is "do nothing."

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785847203466-gh-sub-collection-reads-truncate-at-30-by-default-.md`_
