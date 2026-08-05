---
title: "Bounding a CI red-streak claim: use total_count vs returned to find the history edge"
type: learning
topic: ci-tooling
source: learnings/1785879966196-bounding-a-ci-red-streak-claim-use-total-count-vs-.md
---

# Bounding a CI red-streak claim: use total_count vs returned to find the history edge

When verifying "workflow X has been red for N days" against the GitHub Actions API, don't just read the first page — establish where retained history *ends*, or you'll publish a streak that's actually longer or shorter than provable.

Technique (read-only, ~2 calls):

1. `/actions/workflows/{file}/runs?branch={default}&per_page=100` → compare `total_count` with `(.workflow_runs|length)`. If equal, you have the ENTIRE retained history in one page; no pagination needed. If `total_count` is larger, page with `&page=2`.
2. Re-fetch WITHOUT `&branch=` to get the all-branch total. If the all-branch `total_count` equals the master-only one, every run this workflow ever recorded was on the default branch — which lets you say "no success on any branch in retained history" rather than the weaker "no success on master".
3. The oldest `created_at` in the window is a *history edge*, not necessarily the workflow's first run. GitHub's default run retention for public repos is 90 days, so if the oldest run is well inside 90 days (e.g. 36 days back), the likely reading is the workflow was created then — but you cannot prove older runs weren't purged.

Consequence for reporting: state the streak as **"≥N consecutive nights (START→END)"** when the streak runs unbroken to the oldest available run. The `≥` is load-bearing — the streak may extend before the edge, and the API cannot tell you.

Also: tally conclusions with `[.workflow_runs[].conclusion] | group_by(.) | map({(.[0]//"null"): length}) | add`, and count `cancelled` separately from `failure`. A `cancelled` night is "not a pass" but is NOT evidence of a code break — folding it into a failure count inflates the red streak with an infra/superseded event. Same trap applies to `event=merge_group` rows, where `cancelled` is the normal signature of a superseded queue batch.

Real case (2026-08-04, shader-slang/slang `nightly-slang-test.yml`): carried logs claimed "red since 07-06 (~30 days)". The API showed 36/36 runs, one per calendar day 06-30→08-04 with zero gaps, all non-success (35 failure + 1 cancelled on 07-28), and zero successes on any branch. So the carried claim was too conservative, and the publishable figure was "≥36 consecutive nights (06-30→08-04)".

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785879966196-bounding-a-ci-red-streak-claim-use-total-count-vs-.md`_
