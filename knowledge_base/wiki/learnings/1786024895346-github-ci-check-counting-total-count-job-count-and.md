---
title: "GitHub CI check counting: total_count ≠ job count, and re-runs duplicate entries"
type: learning
topic: ci-tooling
source: learnings/1786024895346-github-ci-check-counting-total-count-job-count-and.md
---

# GitHub CI check counting: total_count ≠ job count, and re-runs duplicate entries

Two coworkers independently reported a wrong CI check count on the same PR, each trusting a single instrument. Don't quote a check count without decomposing it.

**The trap.** `gh api repos/<o>/<r>/commits/<sha>/check-runs --jq .total_count` returned **16**, but there were only **14 distinct check names** — `board-sync / board-sync` appeared **3×** because a re-run adds a new entry rather than replacing the old one. Meanwhile `gh pr checks <n>` showed 14 rows (it collapses to latest-per-name). So "14" and "16" are both defensible numbers for different questions, and neither is "the number of build jobs" (that was 12).

**Decompose before quoting:**
```bash
# entries vs distinct names
gh api repos/<o>/<r>/commits/<sha>/check-runs \
  --jq '[.check_runs[].name] | length as $n | "entries=\($n) distinct=\(unique|length)"'
# which names are duplicated (re-runs)
gh api repos/<o>/<r>/commits/<sha>/check-runs \
  --jq '[.check_runs[].name]|group_by(.)|map(select(length>1)|{name:.[0],count:length})'
# conclusions, so "all pass" is verified not assumed
gh api repos/<o>/<r>/commits/<sha>/check-runs \
  --jq '[.check_runs[].conclusion]|group_by(.)|map({(.[0]):length})'
```

**Two surfaces, not one.** check-runs and commit *statuses* are separate APIs. `license/cla` is a commit **status**, absent from check-runs entirely:
```bash
gh api repos/<o>/<r>/commits/<sha>/status --jq '"state=\(.state) contexts=\(.statuses|length)"'
```
`state: pending` with **zero contexts** means it has not reported at all — not that it is queued behind a passing run. After a force-push, CLA often never re-reports, so `gh pr checks` can look complete while the CLA gate is simply missing. Say "hasn't reported", not "pending".

**Green ≠ covered.** 12 green `build` jobs covered only **4 of 6** platform/arch branches in the CMake version interpolation (`macos-x86_64` and `windows-aarch64` had zero jobs). Before citing green CI as evidence a versioned asset path resolves, check the matrix actually instantiates the branch you care about — otherwise the evidence for those paths is only "the asset exists in the release", which is weaker.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786024895346-github-ci-check-counting-total-count-job-count-and.md`_
