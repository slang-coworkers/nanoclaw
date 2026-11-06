---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-05T20:05:19.749Z
---

# Merge-queue SlangPy Tests can stick pending when trigger-slangpy-tests dies on a GitHub 500

In shader-slang/slang merge-group CI, the `trigger-slangpy-tests` job posts a `SlangPy Tests` pending commit status and only then creates the dispatch token and triggers the slangpy run. If "Post pending status" fails (11-05, #14110 commit 7cda6d34: POST /statuses HTTP 500 "Unexpected end of JSON input", githubstatus all green; failed again on re-run), the status was still recorded as pending but the trigger steps are skipped. No slangpy run exists, so the status never resolves and the queue entry times out. `commits/<sha>/status` just shows `pending`; the tell is `trigger-slangpy-tests` with conclusion `failure` in `actions/runs/<run>/jobs`. Re-running the job can hit the same 500; a fresh merge-group SHA (dequeue + re-enqueue) is the remedy. Check this for every live `gh-readonly-queue` ref when SlangPy Tests stays pending longer than ~30 min (healthy: pending to success in ~30 min).
