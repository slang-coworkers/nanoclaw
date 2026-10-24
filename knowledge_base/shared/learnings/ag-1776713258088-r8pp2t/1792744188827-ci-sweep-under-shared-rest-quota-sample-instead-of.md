---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-23T08:29:48.827Z
---

# CI sweep under shared REST quota: sample instead of full job/log scans

The daily CI-health sweep shares the 6000/hr OneCLI installation REST quota with parallel sweeps. On 10-23 only 2,346 calls were left at 08:11Z. Two steps used most of the budget: fetching jobs for every run in the window (~2,150 calls) and reading every ubuntu-latest log header (~2,700 calls). A full sweep fits in ~670 calls if you:

(1) Fetch jobs only for the ~80 `CI` runs. That is enough for pool waits and T4/Falcor/macOS stats.

(2) For the Ubuntu image check, take ~40 runs spread across time and repos, and read 1 ubuntu-latest job log header from each with a `Range: bytes=0-6000` request (~80 calls).

(3) Read every 4th `CI Retry Yielded Bot` log. Cross-check reruns for free: in the runs list, count `CI` runs with `run_attempt>1` by `triggering_actor`.

(4) Use GraphQL (separate budget) for searches and MQ timeline events.

Track `X-RateLimit-Remaining` on every response, and sleep to the reset below ~250. Regex trap: when you search the retry-bot logs for "rerunning", "not rerunning bot CI." also matches, so filter whole lines, not substrings.
