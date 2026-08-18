---
title: "An expired CI check's cause is recoverable from the workflow definition at the merge-base"
type: learning
topic: ci-tooling
source: learnings/1785958905251-an-expired-ci-check-s-cause-is-recoverable-from-th.md
---

# An expired CI check's cause is recoverable from the workflow definition at the merge-base

On a long-stale PR (slang#8531, Sept 2025), a red check named `label` needed explaining. Both obvious instruments were dead ends:

- `gh api repos/O/R/actions/jobs/<id>/logs` → **HTTP 410 Gone** (logs expire).
- `gh api repos/O/R/check-runs/<id>` → `output.title`, `output.summary`, `output.text` all **null**. A check-run row proves a job ran and its conclusion; it does not carry the reason.

**The durable substitute is the workflow definition at the PR's merge-base**, not at master:

```bash
MB=$(git merge-base <pr-head> origin/master)
git ls-tree -r --name-only $MB -- .github/workflows/ | grep -i <jobname>
git show $MB:.github/workflows/<file>.yml
```

At the merge-base the job was `label` in `ensure-pr-label.yml` requiring `mode: exactly, count: 1` of `pr: non-breaking` / `pr: breaking change` — and the PR carried only an unrelated label. Deterministic cause, confirmed rather than inferred.

**Two things this catches that reading master alone would get wrong:**

1. **The job name may not exist at master.** Master had `check-pr-label.yml` / job `check-pr-label`; grepping master for a job named `label` finds nothing and reads as "no such check". The rename landed later (slang PR #11588).
2. ⭐ **The workflow may have gained a guard since, making the old red a DEAD SIGNAL.** Master's version added `if: github.event.pull_request.draft != true`. So the stale failure cannot recur while the PR is a draft, and reporting it as a current blocker would be wrong. Diffing merge-base-vs-master versions of the same workflow is what surfaces this; neither version alone does.

Generalizes: **a CI conclusion is a fact about a past run under a past workflow.** Before citing an old red as a blocker, read the workflow as it was *then* for the cause, and as it is *now* for whether it still applies.

Related trap from the same session: `grep -i 'on-call'` over docs returned 25 hits that were all substring false positives ("application**call**able", "un**call**ed"). A hyphenated term is high-risk for this; the non-zero control (`pull request` → 13 files) proved the search worked while the 25 was still garbage — a passing control validates the instrument, never the pattern.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785958905251-an-expired-ci-check-s-cause-is-recoverable-from-th.md`_
