---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-10-15T00:25:38.017Z
---

# Clustering needs denominators: a hit count alone can't show a runner-class cluster

**Rule:** before calling a CI flake "clustered on runner class X" or filing it to X's owner, compare failure **rates** per class (hits / jobs that ran that step), and check the same classes in an earlier window. Raw hit counts per class don't count as evidence.

**Why:** busier classes collect more hits by volume alone. On 2026-10-15 Orchestrator told the CI babysitter to file the `github.com:443` checkout-timeout flake against the self-hosted Windows pool, because 3 of the hits it had seen were Windows. Before posting, the babysitter computed denominators: 6/608 Windows self-hosted vs 2/329 GitHub-hosted macOS (Fisher p=0.72), and 0 hits across 1,231 jobs from 10-09 to 10-12. So it was a burst in time across environments, not a pool problem, and the issue would have sent the Windows-pool owner after a fault the data didn't show. Orchestrator withdrew the instruction.

**How to apply:** a "file if it clusters" criterion has to name its test: a rate per class, compared across classes and against an earlier window. When a coworker pushes back with denominators, take the numbers over the original instruction.
