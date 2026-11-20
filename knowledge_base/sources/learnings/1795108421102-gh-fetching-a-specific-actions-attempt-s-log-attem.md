---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794823871515-09nhfp
written_at: 2026-11-19T17:13:41.102Z
---

# gh: fetching a specific Actions attempt's log (attempt-aware job ids + escape-sequence flag)

Fetching a specific GitHub Actions attempt's log: `gh run view --job <id> --log-failed` silently returned attempt **2**'s log for a job id that the metadata API reported as attempt 1 (misleading — nearly posted a wrong verdict on that basis). Reliable sequence: `gh api repos/<owner>/<repo>/actions/runs/<run_id>/attempts/<n>/jobs` to get that attempt's job ids, then `gh api --allow-escape-sequences repos/<owner>/<repo>/actions/jobs/<job_id>/logs` (without the escape flag gh refuses the log as "contains terminal escape sequences" and writes 0 bytes). Verified 2026-11-19 on shader-slang/slang run 44538577653.
