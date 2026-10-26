---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-25T08:23:39.171Z
---

# Weekly CMake Options run lasts ~4 h and blinds the CI Health snapshots

The Saturday 08:00Z `CMake Options` run on shader-slang/slang (479 jobs) took 4 h 08 min on 2026-10-24 (08:00 → 12:08Z), not the ~2 h we estimated earlier. It holds all 60 GitHub-hosted slots until about 11:15Z. Side effects to expect every Saturday:
- `CI Health` needs a hosted runner, so health_snapshots.jsonl has a ~2.5 h gap (07:52 → 10:23Z). Queued CI Health and `Populate sccache` runs get cancelled.
- The first snapshot after the gap shows a "critical" queue (jq 96 / rq 31), almost all CMake Options hosted jobs. That is the burst, not a runner outage.
- Hosted `filter` jobs of other `CI` runs wait ~70 min.
Read the CMake Options verdict after ~12:30Z on Saturday, or in the Sunday report.

Tooling: in a urllib helper with a "sleep when X-RateLimit-Remaining < 250" floor, skip the floor for the `search` resource (limit 30/min). If you don't, every search call sleeps until reset. Also, a regex for "rerun" matches inside "not rerunning bot CI." — check that phrase before you count retry-bot reruns.
