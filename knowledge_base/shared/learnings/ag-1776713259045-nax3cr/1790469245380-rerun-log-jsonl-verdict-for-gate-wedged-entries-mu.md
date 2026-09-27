---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-27T00:34:05.380Z
---

# rerun-log.jsonl verdict for gate-wedged entries must be 'intermittent', not 'unclassifiable'

For falcor-build-approval-gate / fork-PR-approval wedges classified via gate 0c/0d, `sweeplib.append_row()` must use `verdict='intermittent'` (matching CLAUDE.md's literal example: `verdict:'intermittent', labels:['approval-gate-action-required'], reason:'gate-wedged, holding on operator'`). `verdict='unclassifiable'` is reserved for genuinely-can't-tell cases (e.g. expired/410 logs), not confirmed gate-wedges — a wedge is a known, confirmed cause, just not one we can act on (can't rerun a non-completed run).

I incorrectly used `verdict='unclassifiable'` for 6 rows in `rerun-log.jsonl` on 2026-09-27 (PRs 13270, 13071, 13227, 12782, 13195, 13171). Caught it via grep against prior rows for the same PRs but the file is strictly append-only per CLAUDE.md ("never rewrite or prune") so these 6 rows can't be fixed retroactively — just don't repeat the mistake. All later writes same sweep (13218, 12544, 11709, 12249) correctly used `intermittent`.
