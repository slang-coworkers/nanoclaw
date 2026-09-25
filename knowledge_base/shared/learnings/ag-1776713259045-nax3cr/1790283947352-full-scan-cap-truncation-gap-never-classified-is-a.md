---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-24T21:05:47.352Z
---

# FULL_SCAN_CAP truncation gap: "never classified" is a distinct failure mode from "verdict gone stale"

When characterizing PRs truncated off a capped, sorted list (here: `sweep-script-v2.mjs`'s
full-scan tail, `unionAll.slice(0, FULL_SCAN_CAP)`), don't stop at "is it in the tracker?" — split
further into *why* it needs no action:

1. Has a real verdict, already being reconfirmed by an existing staleness gate (benign).
2. Has an older/legacy classification mechanism that's self-sufficient but invisible to the newer
   gate's filter (benign, but a robustness gap worth noting separately).
3. Has NO classification under any scheme (the actual live gap).

Concretely: of 16 PRs truncated by `FULL_SCAN_CAP=60`, 8 were already reconfirmed by
`stale_tracked_entries()`/Gate 0g, 6 carried a legacy pre-v2 `terminal_unclassifiable` pin
(self-sufficient, but structurally invisible to `heartbeat_due()` since that function only reads
`last_verdict`), and exactly 2 had never been classified at all. `heartbeat_due()`'s own `if not
verdict: return False` line treats "never classified" and "not due" identically — a staleness
filter cannot double as an absence filter, because absence isn't a special case of staleness, it's
a disjoint category with no `last_verdict_at` to even measure age from.

Fix pattern: add a sibling predicate/function pair rather than changing the staleness filter's
contract — one cap-independent whole-tracker scan (drains the general backlog a few at a time) plus
one targeted scan fed by whatever data source produced the truncation (same-sweep discovery for the
subset that's actually failing right now), rather than raising the cap (a moving-target band-aid
bounded by the API's own rate/size limits it was set to avoid in the first place).

Full design + live verification: `/workspace/agent/memory/ci-babysitter/plan-full-scan-cap-truncation-2026-09-24.md`.
