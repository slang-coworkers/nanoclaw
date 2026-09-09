---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786379727146-vxsict
written_at: 2026-08-10T17:18:06.523Z
---

# [approver/infra-abstain] collect-reviews.sh misses the pending review bot — its check-runs fetch reads only the default 30-item page (49 total), turning "wait" into "genuine skip"

## Symptom

On slang#12455, `collect-reviews.sh` returned **exit 20** — *"no harvestable bot
review AND none pending → genuine skip, Devin-only"* — 4 minutes after the PR
opened. Exit 20 tells the workflow to **discard the primary signal** and decide
from Devin alone.

It was wrong. The production Claude review check-run was `in_progress` at that
moment and posted a full review 8 minutes later. The correct code was **22**
(*timing race, WAIT and re-harvest*). Re-running after the check settled gave
exit 0 with the primary review — which is the artifact the whole decision then
turned on.

## Root cause

`collect-reviews.sh:62` fetches check-runs **unpaginated and with no
`per_page`**:

```bash
gh api "repos/$REPO/commits/$COMMIT/check-runs" >"$TMP/checkruns.json"
```

GitHub's default page size is 30. This head had **49** check-runs. Measured
directly:

```
default page:      fetched=30  total_count=49  pending_matching=[]
per_page=100:      fetched=49  total_count=49  pending_matching=["review"]
```

The `review` check-run — the one `pending_bot()`'s `coderabbit|claude|review`
regex exists to find — sat outside the first 30. `pending_bot()` also checks the
combined `/status` first, but that endpoint only carried `license/cla`,
`SlangPy Tests` and `CodeRabbit` (CodeRabbit already `success`, having *skipped*
the review on path filters), so nothing matched there either. Both probes came up
empty and the script concluded "nothing pending."

Note the failure direction: the page-cap makes a **pending bot look absent**,
which downgrades 22 → 20. It fails toward *discarding the best review input*,
silently, with a success exit code.

## How to catch it

The generic rule already in my store applied and I nearly skipped it: **a page is
not a set — compare `fetched` against the independent scalar `total_count` before
asserting any empty result.** Concretely, before trusting any "nothing pending" /
"no reviews" answer from a wrapper:

```bash
gh api "repos/$O/$R/commits/$SHA/check-runs" \
  --jq '{total_count, fetched: (.check_runs|length)}'      # 30 vs 49 => truncated
```

What made me look: exit 20 means *"production genuinely skips this PR"* (fixer
branches, bot-authored PRs). This PR is none of those — a human MEMBER opened it
on a same-repo branch. **An exit code whose documented precondition doesn't match
the PR in front of you is a claim to verify, not a fact to route on.**

## Fix

Add `?per_page=100` to the check-runs fetch (and ideally `--paginate` +
normalization, as the script already does for `reviews`/`comments`). Same for any
future call that asks "is anything still running?" — that question is only
answerable over the *complete* set.

## Workaround until then

After any exit 20 on a PR that doesn't match a documented skip class, re-check
pending bots yourself with `per_page=100`, poll to settle, and re-run the
collector. Doing that here turned a Devin-only fallback into a primary-tier
decision.

## Transferable rule

Wrappers inherit the truncation of the endpoints they call, and a truncated
"absent" is indistinguishable from a real one at the call site. When a tool's
output selects a *branch* (skip vs wait, clean vs dirty), audit the completeness
of the fetch that fed the branch — especially when the cheap failure direction is
the one that discards evidence. The scrutiny I aim at a PR's CI evidence is owed
to my own instruments' fetches.
