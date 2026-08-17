---
title: "Two agents citing the same commit while holding different HEADs manufactures a false disagreement"
type: learning
topic: review-approval
source: learnings/1785984972691-two-agents-citing-the-same-commit-while-holding-di.md
---

# Two agents citing the same commit while holding different HEADs manufactures a false disagreement

# Pin the SHA in every CI claim — "at this same commit" is not a SHA

**Measured 2026-08-06 on shader-slang/slang#12354.** Two of our own coworkers published
contradictory CI findings on the same PR. Both were correct about their own commit; neither
named it, so the disagreement read as one party being wrong.

| commit | who measured it | failing `test-slang` legs |
|---|---|---|
| `0c7f96d0b` (15:36Z) | CI babysitter (cmt 5196958664, reran 18:26Z) | **3**: linux-debug-gcc-x86_64, windows-debug-cl-x86_64-gpu, windows-release-cl-x86_64-gpu |
| `4bac3b2d2` (17:23Z) | triager (cmt 5199770804 on #12376) | **1**: windows-release-cl-x86_64-gpu |

Triage published *"the failure is windows-release-specific"* and framed it as correcting our bot.
That statement is **true at `4bac3b2d2` and false at `0c7f96d0b`** — two commits landed in between
(`52a243860`, `4bac3b2d2`). Both parties wrote the phrase "at this same commit" while holding
different HEADs.

⇒ **Every CI claim carries the SHA it was measured at, in the published text.** `gh api
repos/<o>/<r>/commits/<sha>/check-runs` is per-commit; a PR-level statement without a SHA has no
referent once the branch moves. On a branch taking 7 commits in a day, a leg census is stale in
hours.

## Two sub-rules from the same incident

**1. Before "correcting" a peer's published claim, read the peer's artifact in full.** Triage
offered as its *decisive control* that `test-linux-release-gcc-x86_64` has both options ON, runs all
three tests, and passes. The babysitter comment **already contained that control** — *"those same
three tests pass on the sibling `test-linux-release-gcc-x86_64 / test-slang` leg at this same
commit (100% of tests passed (7129/7129))"* — and had labeled its cause bullet **"Hypothesis (not
verified by execution)"**. Re-deriving a counterparty's own control and presenting it as a
refutation of that counterparty puts a false implication ("they lacked the control") into a
maintainer-facing comment. Correct the *claim*; do not narrate a novelty you did not verify.

**2. A commit-boundary check can refute your own hypothesis — run it before publishing.** Triage
offered "the PR turns on a never-run IR validator on the same commit whose CI is red" as an untested
alternative cause. But the commits that enable full-IR validation coincide with the failing set
going **3 legs → 1**. Directionally *against* the hypothesis. One `check-runs` call per commit
across the boundary would have surfaced that. (Different runs, so runner variance isn't excluded —
which is exactly why it should have been published as bounded, not as a lead.)

## The detector

```bash
# Failing legs at a specific commit — the only per-commit question that has an answer
gh api "repos/<owner>/<repo>/commits/<sha>/check-runs?per_page=100" --paginate \
  --jq '.check_runs[] | select(.conclusion!="success") | "\(.conclusion)\t\(.name)"' | sort

# Run the SAME query at the commit your counterparty measured, before disagreeing.
# Also check attempts — a rerun can change the set under a stable SHA:
gh api "repos/<o>/<r>/actions/runs/<id>/attempts/<n>/jobs?per_page=100" --paginate \
  --jq '.jobs[] | select(.name|test("test-slang$")) | "\(.conclusion)\t\(.name)"' | sort
```

Also observed: run `31052137029` was `attempt=2` and flipped to `completed/cancelled` **8 minutes
after** the triage comment posted. Any bare "CI is red" line has a shelf life of minutes on an
active PR — state the SHA, the run id, and the attempt, or don't make the claim.

## Unrelated but worth recording

One `gh api` call returned OneCLI `app_not_connected` / HTTP 401 mid-sweep; three immediate retries
succeeded. A single 401 under OneCLI is not evidence of a lost credential — retry before escalating
a PAT restore to the operator.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785984972691-two-agents-citing-the-same-commit-while-holding-di.md`_
