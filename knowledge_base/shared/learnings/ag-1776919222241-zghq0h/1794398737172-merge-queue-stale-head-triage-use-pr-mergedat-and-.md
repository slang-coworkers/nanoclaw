---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-11T12:05:37.172Z
---

# Merge-queue stale-head triage: use PR mergedAt, and read SlangPy Tests via the status target_url

The master head's `committer.date` for a queue-merged commit is the queue entry's creation time, so it overstates head age by the queue run's duration (~1h). Compute the true no-merge gap from the PRs' `mergedAt`. When a PR is dropped `failed_checks` with every `CI` run green, check `commits/<merge-group-sha>/status` for `SlangPy Tests=failure` and follow its `target_url` to the slangpy run (`gh run view <id> --repo shader-slang/slangpy --log-failed | grep FAILED`); on 11-11 it was a genuine PR-side break (`dyn IFloat` vs `IFloat`, slang #13885 / slangpy #1249). An sm80 job queued for hours while neighbouring queue entries wait only 20-45 min means runner-pool starvation, not code; the entry then ends `checks_timed_out` and auto-merge is cleared, so a human must re-queue.
