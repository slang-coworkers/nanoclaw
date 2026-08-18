---
title: "A dormant workflow makes its own red-rate measurement a false zero (falcor-test.yml vs ci.yml's test-falcor job)"
type: learning
topic: ci-tooling
source: learnings/1786220895747-a-dormant-workflow-makes-its-own-red-rate-measurem.md
---

# A dormant workflow makes its own red-rate measurement a false zero (falcor-test.yml vs ci.yml's test-falcor job)

**2026-08-08.** Ranking CI flake cost needs an *independent* basis (a live job cross-section), not my own rerun ledger. Two traps hit in one measurement:

**1. The workflow you name may be dormant.** `falcor-test.yml` has `total_count=11683` runs — looks like the obvious basis for "how often does falcor fail?" But its newest run started **2026-06-17**, ~52 days stale. Today's falcor failures come from the **`test-falcor` job inside `ci.yml`**, an entirely different surface. A workflow having a huge `total_count` says nothing about whether it still runs. **Probe: print the newest `run_started_at` before trusting a workflow as your basis.**

**2. The page cap produced a confident false zero — and only an unconditional assert caught it.** My loop capped at 12 pages: `got=1200 < total_count=11683`, and the runs endpoint returns **newest-first**, so 1200 rows covered only back to mid-June. The 7-day filter then yielded **`runs in last 7d: 0`** at exit 0 — which reads as "falcor never runs / is healthy." The only thing that flagged it was asserting `got >= total_count` *unconditionally*. Had I compared against `len(distinct_ids)` or skipped the assert, the 0 would have shipped.

Correct measurement (`ci.yml` runs since a date, then enumerate falcor jobs, bucketing 4 ways with `status` before `conclusion`):
```
ci.yml runs since 2026-08-01: got=506 total_count=506 assert=True
falcor JOB executions seen: 744
buckets: {'success': 403, 'failure': 27, 'UNTESTED_skipped': 260, 'UNTESTED_cancelled': 53, 'nonterminal': 1}
RED RATE over success+failure ONLY: 27/430 = 6.3%
failing hosts: {'SLANGWIN5': 14, 'SLANGWIN4': 9, 'kernelvm-falcor-bridge': 3, 'kernelvm-falcor-bridge-2': 1}
```
Note `UNTESTED_skipped`=260 + `UNTESTED_cancelled`=53 — **313 of 744 executions tested nothing.** Folding those into a denominator would have reported ~3.6% instead of 6.3%, nearly halving the apparent cost. Host spread (both SLANGWIN4 and 5) confirms host-agnostic ⇒ quarantine the test, don't depool a runner.

**How to apply:** when ranking a flake's live cost, (a) verify the workflow is still active by its newest run timestamp, (b) assert `got >= total_count` unconditionally on every paginated fetch — a windowed filter turns a silent short into a plausible zero, and (c) compute the ratio over `success+failure` only. Also: don't group your *own ledger's* declines by check label to find "today's spike" — one sweep logging 17 stale-backlog rows under a label containing the flake's name manufactures a fake 23-hit spike that measures your sweep, not the repo.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786220895747-a-dormant-workflow-makes-its-own-red-rate-measurem.md`_
