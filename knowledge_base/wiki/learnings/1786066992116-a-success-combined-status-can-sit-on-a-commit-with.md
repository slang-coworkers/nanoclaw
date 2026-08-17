---
title: "A `success` combined status can sit on a commit with ZERO check-runs — count runs, don't read the rollup"
type: learning
topic: misc
source: learnings/1786066992116-a-success-combined-status-can-sit-on-a-commit-with.md
---

# A `success` combined status can sit on a commit with ZERO check-runs — count runs, don't read the rollup

On shader-slang/slang#11225 the head commit `7342e358e5` showed **combined status `success`** and a clean `statusCheckRollup` — but had **0 check-runs and 0 check-suites**. The only two reporters were external status contexts (`license/cla`, `CodeRabbit`); no GitHub Actions workflow ever ran. Nothing had been built or tested against that commit, yet every summary view read green.

This is a distinct trap from the known "docs-only PR ⇒ success with 34/36 skipped" case: there the jobs exist and are `skipped`. Here **the jobs do not exist at all**, so any jq that iterates `check_runs[]` or `statusCheckRollup[]` and inspects `conclusion` yields an empty set, and "no failures found" renders as success. A rollup with 2 entries looks unremarkable next to one with 48.

**The instrument:** gate on a **nonzero count of non-skipped check-runs**, not on the absence of failures.
```bash
gh api "repos/<o>/<r>/commits/<sha>/check-runs" --jq '.total_count'   # 0 ⇒ NOTHING RAN
```
Same family as "a zero exit means nothing errored, not that something ran" — an affirmative marker beats an absence-of-negatives.

**Controls that made the finding attributable rather than a guess about a broken CI:**
1. **Cross-head control** — previous head `f517148` had 48 check-runs / 12 workflow runs. Same PR, same workflows, so the config isn't the explanation.
2. **Repo-wide liveness control** — 100+ runs repo-wide after the push timestamp, and unrelated PRs got `pull_request` runs inside the same one-hour window ⇒ not an Actions outage.
3. **Push-registered control** — `license/cla` and `CodeRabbit` both posted statuses ~24 min after the commit date, so the ref update was definitely observed. That rules out "the push never landed."
Without #2 I would have written "Actions is down"; without #1, "this workflow is misconfigured." Both would have been wrong.

**Also verified, worth reusing:** `git ls-remote origin refs/heads/<branch>` returning nothing for a fork-based PR branch (with `refs/heads/master` as the positive control) confirms the branch lives only in the fork — relevant because fork PRs take different trigger paths (`pull_request_target`, bridge workflows).

**Bonus trap hit in the same session:** a subagent reported "~10 unrelated files changed, deletes a 510-line unit test." That was a **two-dot diff artifact** — the branch had a master merge commit, so `git diff master..HEAD` shows upstream's changes inverted. `git diff $(git merge-base master HEAD)...HEAD` gave the true diff: 9 files, all capability-related. Always three-dot, and re-derive a delegated diff claim before relaying it upstream.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786066992116-a-success-combined-status-can-sit-on-a-commit-with.md`_
