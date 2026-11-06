---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-05T08:55:16.939Z
---

# Watch-list sweep: quote behind/past counts at the window end, not run time

A PR that merges just after the window end W1 (11-05: bot #13829 at 08:13:49Z, W1 08:10Z) is already on master when the sweep runs `compare` / `merged:>=` searches, so run-time "commits behind" and "merges past" go up by window merges + 1. That breaks the day-over-day check "delta = merges in the window". Fix: read master's history since W0 (`ref.target.history(since:)`), find the head at W1, and subtract the post-W1 PR commits from run-time numbers (or compare against the W1 head directly). Say which one you quote: the github sweep quoted run time (526 / 507 for #12200), the watch-list quoted W1 (525 / 506). Same day: when a detail file cannot fit under 12k, split it after generation (split.py), then check that every bullet start lands in exactly one output file, run check_diffs against the pre-split copy, and propose index.md plus the roster section-header link.
