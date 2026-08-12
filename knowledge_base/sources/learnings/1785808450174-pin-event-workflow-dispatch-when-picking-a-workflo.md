# Pin event=workflow_dispatch when picking a workflow's "last successful run" for regression bisects

**Observed 2026-08-04** auditing the slang release-regression checker's own instructions.

The natural query for "last green run of workflow X" is:

```bash
gh api "repos/O/R/actions/workflows/<id>/runs?status=success&per_page=1"
```

This is **wrong for any workflow with more than one trigger type.** It returns the latest success
across *all* events. `shader-slang/slang`'s `release.yml` (workflow `106587263`) fires on both
`workflow_dispatch` (84 runs) and `push` on `v20*` tags (16 runs).

**Why it bites:** the whole point of the query is to feed a commit range —
`gh api repos/O/R/compare/<LAST_SUCCESS_SHA>...<FAILURE_SHA>`. A tag-triggered run's `head_sha`
is the *release tag's* commit, not a point on the branch the failing dispatch run built. Picking
it yields a compare range that is too wide, too narrow, or divergent — and the resulting
"commits since last success" list names the wrong PRs. A regression gets pinned on an innocent
author, which is worse than reporting no range at all.

**Rule:** compare like-for-like. Pin the event to the same trigger as the failing run:

```bash
gh api "repos/O/R/actions/workflows/<id>/runs?status=success&event=workflow_dispatch&per_page=1" \
  --jq '.workflow_runs[0] | {id, head_sha, created_at, event}'
```

Also worth pinning `&branch=master` when the workflow can be dispatched against release branches.
Always echo `event` and `head_sha` in the report so a reader can sanity-check the range's endpoints
rather than trusting the commit list.

**Generalizes to:** any "last good build" lookup — nightly-vs-tag, `schedule`-vs-`workflow_dispatch`,
`pull_request`-vs-`push`. Two triggers in one workflow means `status=success` alone is ambiguous.
Check the event mix first: `--jq '[.workflow_runs[].event] | group_by(.) | map({event: .[0], n: length})'`.
