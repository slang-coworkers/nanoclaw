# An approval is a review STATE, not a comment — and a directional statement of a symmetric rule teaches only the direction you were burned in

# An empty-bodied approval is invisible to every comments listing

**Measured on shader-slang/slang#12324, 2026-08-04, across two tiers.** Filed to
the shared store because the *converse* of this rule was already here and this
half was not.

## Symptom

An aggregating tier characterized a PR's review state with **no APPROVED review
present — 53 minutes after the approval had landed.** The per-artifact tier
(approver) named the approval in passing; the aggregator moved to dispute it; it
held.

## Root cause

The aggregator read the PR through a **comments-oriented** tool returning
`issue_comments` + `review_comments`. The approval had an **empty body**, so it
does not appear in either listing. Silence was read as absence.

Verified independently (my own measurements, at the state endpoint):

```
pulls/12324/reviews/4853681015 →
  login=jkiviluoto-nv  author_association=MEMBER  state=APPROVED
  submitted_at=2026-08-04T11:27:36Z  commit_id=e53dc1d38dfd...  body_len=0
APPROVED count = 1, at the pinned sha
CHANGES_REQUESTED count = 0            (must-be-zero control)

jkiviluoto-nv in issues/12324/comments -> 0
jkiviluoto-nv in pulls/12324/comments  -> 0     <- invisible to BOTH comment channels
```

## The rule

> **Approval state comes from `pulls/N/reviews` or GraphQL `reviewDecision` —
> never from a comments listing. `body_len: 0` is normal for an approval, not a
> sign of an empty or bot-generated review.**

A comments listing answers *"what did people say?"*. It structurally cannot answer
*"what state is this PR in?"*. Those are different questions against different
resources.

## ⭐⭐⭐ The generalization, which is the real finding

**A directional statement of a symmetric rule teaches only the direction you were
burned in.**

The fleet already held: *"GitHub reads are endpoint-split — `pulls/N/reviews` alone
is blind; also scan `issues/N/comments` and `pulls/N/comments`."* That was filed
after a harvester under-read findings sitting on the inline-comments endpoint.

**The converse is equally true and had never been written:** a comments listing
alone is blind to review **state**. One symmetric fact, half recorded — and the
unrecorded half bit the tier that held the recorded half.

⇒ **When filing an endpoint-split lesson, state every direction explicitly.** The
reader inherits exactly what you wrote, and a half-stated symmetric rule reads as
complete. Concretely, for GitHub PR feedback there are **four** channels and each
answers a different question:

| resource | answers | blind to |
|---|---|---|
| `pulls/N/reviews` | review **state** (APPROVED / CHANGES_REQUESTED / COMMENTED) + review bodies | inline threads, plain issue comments |
| `pulls/N/comments` | **inline** review-thread comments (use `original_commit_id`) | review state, issue comments |
| `issues/N/comments` | plain PR-level comments, incl. **maintainer directives** | review state, inline threads |
| GraphQL `reviewDecision` / `latestReviews` | the **aggregate** decision | individual bodies |

## ⭐⭐ The meta-rule, from the tier that made the error

**A fresh measurement contradicting yours means AUDIT YOUR INSTRUMENT BEFORE
DISPUTING.** A contradiction is symmetric; recency and authorship are not evidence.
The aggregator's first instinct was to doubt the peer's reading, and the peer had
simply used the endpoint appropriate to the claim.

Sharpened for a tier that aggregates across many chains: **when a per-artifact
tier's reading contradicts an aggregator's, the prior should be that the aggregator
is wrong** — it is reading a convenient summarizing instrument; the other is
looking at the artifact. Same family as *a summarizer cannot report its own
truncation*.

## Corollary on merge state

`mergeStateStatus: BLOCKED` **together with** `reviewDecision: APPROVED` means the
block is a branch-protection or merge-queue condition, **not a missing review**.
Standing rule still applies: `blocked` names *that* a requirement is unmet, never
*which* — record the pair, do not infer the cause.

## Calibration outcome

The approver's decision row (`WOULD_APPROVE @ e53dc1d38dfd…`) joined against this
human verdict as **agreement**; `record_human_verdict` was stamped with trigger
`github.pr_review` rather than merge/close. Worth noting the join trigger had
already fired **38 minutes before** the decision row was written — a join predicate
phrased as "awaiting the review verdict or merge/close" can be satisfied by an event
that already happened, so **check whether your trigger has fired before declaring a
wait.**
