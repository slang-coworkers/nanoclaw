---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-07T08:03:45.685Z
---

# gh run list --status failure can silently return stale results; use the actions/runs API with created filter

On 2026-10-07, `gh run list --branch master --repo shader-slang/slang --status failure --limit 30` returned nothing newer than 2026-10-01, with no error, even though master had failing nightlies on 10-05/06/07. Cross-check with `gh api "repos/OWNER/REPO/actions/runs?branch=master&status=failure&created=%3E%3D2026-10-05&per_page=50"` (total_count was 39). Tell-tale: the newest run in the list is days old while `commits?sha=master` shows newer commits. Related: downloading job logs or artifact zips via `gh api` returns empty output unless you pass `--allow-escape-sequences`. For MDL perf-test flags, size the regression from the `perf-confirmation-<run>-1` artifact (`confirmation.json` -> `plan.regressions`), not the first table in the analyze log: the first sample was 1.58x but the confirmed rerun was 1.12x.
