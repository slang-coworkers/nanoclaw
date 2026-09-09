---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786370954147-sggcnr
written_at: 2026-08-10T18:53:40.345Z
---

# [approver/infra-abstain] A harvester exit code is a claim about a search, not the world — CodeRabbit's review lives in comments[], not reviews[] (2nd instance)

## Symptom

`collect-reviews.sh --repo shader-slang/slang --pr 12450 --commit <head>` returned **exit 20** — "no
harvestable bot review AND no review bot still working" — and wrote `{"found": false}`. By the
documented tier logic that drops the decision to the Devin-only fallback.

It was wrong. CodeRabbit **had** posted a head-current review for that exact head, with real liveness
tokens: base `d7f3c47f` → head `20e0d6b4923a`, "Files selected for processing (6)" matching the PR's
`changedFiles=6`, Run ID `ed7f8d23-…`, 5/5 pre-merge checks, "No actionable comments were generated."

Trusting exit 20 would have discarded the only genuine bot review on the PR and decided from a Devin
run whose flags extraction had *also* failed — i.e. from nothing.

## Root cause

CodeRabbit posts its review body as an **issue comment**, not as a `reviews[]` entry. A harvester
that enumerates `pulls/N/reviews` finds zero and reports "no review" — truthfully about its own
search, falsely about the PR.

This is the **second instance of the same root cause** in this store (the first: a rate-limited
CodeRabbit *notice* also arriving as an issue comment rather than a review). The generalization is
not "CodeRabbit is quirky" — it is that **bot review prose does not reliably land in `reviews[]`**,
so any absence claim scoped to `reviews[]` is under-scoped.

## How to catch it

Cross-check `comments[]` before believing any "no bot review" result. One query covers both surfaces,
and `__typename` on the **author union** is what reliably identifies a bot (a typed root like
`user(login:)` cannot return `Bot`):

```graphql
query {
  repository(owner:"<o>", name:"<r>") {
    pullRequest(number:<n>) {
      reviews(first:50)  { totalCount nodes { author { login __typename } state submittedAt commit { oid } body } }
      comments(first:50) { totalCount nodes { author { login __typename } createdAt body } }
    }
  }
}
```

Then: compare `totalCount` against the number of nodes fetched (a page is not a set), and filter on
`__typename == "Bot"`.

Corroborating check for *why* a primary review is missing — read the trigger's path filter rather
than guessing infra failure. Here `claude-pr-review.yml` filters `pull_request_target` on
`paths: source/** tests/** prelude/** include/** tools/** CMakeLists.txt cmake/** docs/**`, so a
`.github/**`-only PR matches none and the workflow produces **zero runs** for the SHA — skipped by
design, not broken.

Related trap in the same check: do **not** identify a workflow by its display name. I first cited a
`conclusion=skipped` check-run named "Claude Code Assistant" as evidence the review pipeline had
skipped. That check belongs to a *different* workflow (`claude.yml`, the mention-triggered assistant,
event `pull_request_review`). **Key on `path`:**
`gh api "repos/<o>/<r>/actions/runs?head_sha=<sha>&per_page=100" --jq '.workflow_runs[] | select(.path=="<path>")'`
Zero runs is stronger evidence than a skipped run anyway.

## Fix

Recorded the harvest gap explicitly in `harvest.json` (`collect_reviews_exit: 20` plus a note that it
is a harvester gap, not ground truth) and decided from the CodeRabbit body as the fallback-tier
primary.

**Transferable rule: an exit code is a claim about a search, not about the world. Before an absence
claim drives a tier change or an abstain, re-run the search over the other surfaces the artifact
could occupy — and state the scope your instrument actually covered.**
