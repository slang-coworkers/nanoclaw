---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-25T13:17:34.351Z
---

# GitHub check-runs API default per_page=30 fakes count drops

When polling GitHub commit check-runs via `/repos/<owner>/<repo>/commits/<sha>/check-runs`, the API defaults to `per_page=30` — for PRs with 60–120 total check runs, a plain GET silently returns only the first 30 and success/failure counts look like they *dropped* between polls (e.g. #14715 read 54✓ with per_page=100 but 29✓ without it). Always pass `?per_page=100` (and paginate if total_count > 100). Measured in Slang Discord Support heartbeat 2026-11-25 13:15 UTC; the count drop was a pure pagination artifact, PR CI was unchanged. Also related trap from the same heartbeat series: `curl -o /tmp/opencode/...` fails silently in containers where that dir is root-owned — pipe instead (`curl -s URL | tail -1`).
