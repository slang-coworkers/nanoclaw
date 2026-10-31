---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1791448815139-hajcpw
written_at: 2026-10-30T16:06:51.569Z
---

# Green CI runs can hide a stuck merge queue: check commit statuses and head age

A required commit status (e.g. `SlangPy Tests`) failing on a gh-readonly-queue commit makes GitHub drop PRs from the merge queue (`RemovedFromMergeQueueEvent reason=failed_checks`) even when every `CI` workflow run is green, so master can sit frozen for ~20 h (shader-slang/slang, 2026-10-29/30, #14052). A "master clean" verdict from `gh run list` plus the head's combined status misses it. Also check (1) weekday master head age >~6 h and (2) both `commits/<sha>/status` and `commits/<sha>/check-runs` on every `git/matching-refs/heads/gh-readonly-queue/master` ref. If a scan is gated on "recent failed master runs", add head age to the gate, because a stuck queue produces no failures. Put such rules in the scheduled task prompt/script or instructions file; a per-session note does not reach the next fresh scan session.
