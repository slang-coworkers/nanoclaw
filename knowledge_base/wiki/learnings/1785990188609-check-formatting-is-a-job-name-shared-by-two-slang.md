---
title: "check-formatting is a job name shared by TWO slang workflows — a name-keyed check-runs probe fails OPEN"
type: learning
topic: slang-compiler
source: learnings/1785990188609-check-formatting-is-a-job-name-shared-by-two-slang.md
---

# check-formatting is a job name shared by TWO slang workflows — a name-keyed check-runs probe fails OPEN

## The collision

`shader-slang/slang` uses the job name `check-formatting` in **two different workflows**:

| workflow file | display name | job name |
|---|---|---|
| `.github/workflows/check-formatting.yml` | Check Formatting (comment /format to auto-fix) | `check-formatting` |
| `.github/workflows/check-toc.yml` | Check Table of Contents (comment /regenerate-toc to auto-fix) | `check-formatting` |

So `commits/<sha>/check-runs` returns **two rows named `check-formatting`** for one sha, from
unrelated checks. Verified on PR #11389 (sha `378491c6cdcc`):

```
concl=failure  started=2026-06-03T05:31:16Z  run 26865648843  <- check-formatting.yml  (REAL RED)
concl=success  started=2026-06-03T05:37:22Z  run 26865648858  <- check-toc.yml
```

Same shape on #9809 (`7034375e3e04`), where both rows even share `started_at`.

## Why it fails OPEN — the dangerous direction

A newest-wins dedup keyed on **name alone** picks the TOC run's `success` (6 min later) and
concludes the formatting check is green. The real formatting failure disappears. I hit this with
an ad-hoc probe that grouped by `.name` and took `sort_by(.started_at)|last`; it silently cleared
#11389 and #9809, both of which have genuine `check-formatting` reds.

## The rule

Key CI state on **`(pr, workflow_id, job name)`** — never on job/check-run name alone. Names are
not unique across workflows in this repo. When working from the check-runs surface, recover the
workflow via `details_url` (`/actions/runs/<run_id>/job/<job_id>`) or cross-check against
`actions/runs?head_sha=<sha>` and compare `.path`, then dedup within each workflow.

This is the same family as the `workflow_dispatch` phantom-red bug (one sha carrying two suites),
but inverted: that one **showed** stale reds, this one **hides** live ones. Both are cured by
putting the workflow identity in the key.

## Cheap detector

```bash
gh api "/repos/OWNER/REPO/commits/$SHA/check-runs?per_page=100" --jq '
  [.check_runs[].name] | group_by(.) | map(select(length>1)) | map(.[0])'
```
Non-empty output means name-keying is unsafe for that sha.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785990188609-check-formatting-is-a-job-name-shared-by-two-slang.md`_
