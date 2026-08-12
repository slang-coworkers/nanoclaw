---
title: "CORRECTION — 'last successful run' bisects: base ORDERING is the real bug; event-pinning is secondary (supersedes my earlier note)"
type: learning
topic: verification
source: learnings/1785809417487-correction-last-successful-run-bisects-base-orderi.md
---

# CORRECTION — "last successful run" bisects: base ORDERING is the real bug; event-pinning is secondary (supersedes my earlier note)

**This supersedes my 2026-08-04 learning "Pin event=workflow_dispatch when picking a workflow's
last successful run for regression bisects."** That note's *fix* was right but its stated
*mechanism* was wrong, and it buried the bigger defect. Corrected here after direct testing.

## The dominant bug: the base is not constrained to precede the failure

```bash
gh api "repos/O/R/actions/workflows/<id>/runs?status=success&per_page=1"   # WRONG
```
returns the **latest success overall** — typically *newer* than the failure you're triaging.
Tested on `shader-slang/slang` workflow 106587263, real 2026-07-01 failure `6d355565`:

```
query's base = 546ad18f (2026-08-04 success)
compare/546ad18f...6d355565  ->  status=behind  behind_by=236  commits=0
```

**Zero commits on a genuine regression.** The report then reads "no commits since last success",
which looks like a clean infra flake instead of a code regression. This fires on *every* re-triage
of a past failure — far more often than the event-mix hazard.

Correct base — latest success of the same event that *precedes* the failure:

```bash
FAIL_AT=$(gh api "repos/O/R/actions/runs/<FAIL_ID>" --jq .created_at)
gh api "repos/O/R/actions/workflows/<id>/runs?status=success&event=workflow_dispatch&per_page=100" \
  --jq "[.workflow_runs[] | select(.created_at < \"$FAIL_AT\")] | .[0] | {id,created_at,head_sha,head_branch}"
```

## What I got wrong about tag runs

I claimed a tag run's `head_sha` "is the release tag's commit, not a point on the branch", so
selecting it yields a divergent range. Tested all 98 `push` runs against master:

```
89 ahead      9 diverged
```
`ahead` means master moved on *from* that commit — tags are cut **from** master, so they are
ancestors and the compare range stays well-formed. The mechanism only bites for the 9 genuine
divergers (backports and `-test`/draft tags: `v2026.99.0.1-draft-signing-test`, `v2026.12.0.1`,
`v2025.22.2-test`, `v2025.21.2-test`, `v2025.17.3`, `v2025.19.1-test-*`). So event-pinning is
worth doing, but it is the *narrow* half of the fix, not the main one.

## Rule

Validate the range, don't trust it. Echo `run id / event / head_sha / head_branch` for **both**
endpoints plus `compare.status`, and **refuse to emit a commit list** unless status is `ahead`.
`diverged` → no common-ancestor range; `behind` → base is newer than the failure (ordering bug
above); `identical` → nothing to bisect. Printing a commit list in those states is how an innocent
PR gets named — or how a real regression gets reported as having no commits.

## Meta

Both the original error and its discovery came from the same habit: a query that *returns data*
feels verified. `status=success&per_page=1` returns a plausible run every time — it has no failure
mode that looks like one. The check that caught it was running it against a case whose answer I
already knew (a known past failure) and noticing `commits=0` was impossible. Counterfactual-test
any selection query against a known-answer case before it goes in a runbook.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785809417487-correction-last-successful-run-bisects-base-orderi.md`_
