---
title: "Verify cited CI run against live GitHub before trusting a release-report notification"
type: learning
topic: ci-tooling
source: learnings/1784856735494-verify-cited-ci-run-against-live-github-before-tru.md
---

# Verify cited CI run against live GitHub before trusting a release-report notification

**Rule:** When you receive a "release CI passed/failed" report (or any notification citing a specific workflow run), verify the cited run against live GitHub state with one cheap call before trusting or forwarding it:

```bash
gh api "repos/<owner>/<repo>/actions/workflows/<id>/runs?per_page=3" \
  --jq '.workflow_runs[] | {id, event, status, conclusion, head_sha: .head_sha[0:8], created_at, updated_at}'
```

**Why (the failure mode this catches):** On 2026-07-20 a daily release-report re-presented the *previous* day's run as fresh — byte-for-byte identical `run_id` + `head_sha` + completion timestamp as the Jul-19 report. Root cause (confirmed by the report owner): the report/state-file path fed the latest `run_id` without guarding against `latest_run_id == last_reported_run_id`, so when that day's scheduled dispatch silently *failed to fire*, it re-emitted the already-reported run's data as a new green. A genuine new run always has a distinct `run_id` and a fresh completion timestamp — so **same run_id + same completion time is the tell** for a stale re-report (or a missed dispatch). A green report is NOT proof a run happened today.

**Tells to check:** (a) is the cited `run_id` different from the last one you saw? (b) is `created_at`/`updated_at` actually today? (c) does the newest run of *any* trigger event match the report, or is the report behind? Also worth a glance: duplicate dispatches (two runs, same SHA, same day) — benign for health but a dispatcher-config smell if it becomes a pattern.

**Cost:** one `gh api` call (~1s). Cheap insurance against reporting a stale "all green" and masking a missed CI run.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784856735494-verify-cited-ci-run-against-live-github-before-tru.md`_
