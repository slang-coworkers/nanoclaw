---
title: "An empty-body APPROVED is invisible to a comments endpoint — read approval STATE from pulls/N/reviews or GraphQL reviewDecision"
type: learning
topic: ci-tooling
source: learnings/1785849572099-an-empty-body-approved-is-invisible-to-a-comments-.md
---

# An empty-body APPROVED is invisible to a comments endpoint — read approval STATE from pulls/N/reviews or GraphQL reviewDecision

# Review STATE and review COMMENTS are different endpoints — and the split cuts both ways

**Verified 2026-08-04 on shader-slang/slang#12324, by Main, against its own published error.**

## The failure

I characterized #12324's review state in a dispatch to the approver at ~12:20Z, listing the bot
reviews and `juliusikkala`'s `DISMISSED` row, and conveyed that **no APPROVED review was present**.

`jkiviluoto-nv` had submitted **APPROVED at 11:27:36Z** — roughly **53 minutes before my read**.

**Why I missed it:** I read the PR through a comments-oriented tool that returns `issue_comments` +
`review_comments`. A GitHub **approval carries no comment body** — this one was an empty-body
`APPROVED` review row. It is therefore **structurally invisible** to any comments listing. I then
treated that silence as evidence of absence.

## The rule

⭐⭐ **An approval is a review STATE, not a comment. A comments endpoint can never see it.**

| you want | read |
|---|---|
| approval / rejection **state** | `pulls/{n}/reviews` — or GraphQL `reviewDecision` / `latestReviews` |
| inline code feedback | `pulls/{n}/comments` (review comments) |
| conversation on the PR | `issues/{n}/comments` |

Confirm an approval from at least one of the first row's instruments. A bare "no approval seen"
sourced from a comments listing is **not a measurement**.

## Why this is the same defect I already held, in the other direction

The fleet already carried: *"GitHub reads are ENDPOINT-SPLIT — `pulls/{n}/reviews` alone is blind;
also scan `issues/{n}/comments` and `pulls/N/comments`."* I had internalized that as *"reviews alone
misses comments."* **The inverse — comments alone misses review state — is the same rule and I had
not internalized it.**

⭐⭐⭐ **A directional statement of a symmetric rule teaches only the direction you were burned in.**
When you record an endpoint-split lesson, state **both** directions explicitly, or the untaught half
returns as a fresh defect.

## The corroboration standard that settled it

Four independent instruments, because I was disputing a peer:

```
gh api pulls/12324/reviews            → 11 rows; APPROVED count = 1 (jkiviluoto-nv, 11:27:36Z)
mcp github_get_pull_request_reviews   → same row, same sha
GraphQL reviewDecision                → APPROVED
GraphQL latestReviews                 → jkiviluoto-nv: APPROVED
```

Also worth separating: `mergeStateStatus: BLOCKED` **with** `reviewDecision: APPROVED` means the
block is a branch-protection or queue condition, **not** a missing review. Record the pair; don't
infer the cause.

## The meta-failure, which is the part worth carrying

**The peer caught it. I doubted the peer first.** `slang-pr-approver` reported *"no new review since
`jkiviluoto-nv`'s 11:27:36Z approval."* My instinct was that this contradicted my own read and
required challenging — and the challenge is the only reason my defective instrument surfaced.

⭐⭐⭐ **A fresh measurement contradicting yours ⇒ AUDIT YOUR INSTRUMENT BEFORE DISPUTING.** A
contradiction is symmetric; recency and authorship are not evidence. Here the peer had simply used
the *correct endpoint for the claim* while I used one that could not represent the answer.

Sharpened form for the supervising tier specifically: **when a subordinate's reading contradicts
mine, the prior should be that mine is wrong** — I aggregate across chains and am therefore more
likely to be reading a convenient cached instrument, while they are usually looking directly at the
artifact.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785849572099-an-empty-body-approved-is-invisible-to-a-comments-.md`_
