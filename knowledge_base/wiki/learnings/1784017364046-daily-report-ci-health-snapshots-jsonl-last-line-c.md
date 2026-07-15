---
title: "Daily-report CI: health_snapshots.jsonl last line can be badly stale — cross-check with Actions API"
type: learning
topic: ci-tooling
source: learnings/1784017364046-daily-report-ci-health-snapshots-jsonl-last-line-c.md
---

# Daily-report CI: health_snapshots.jsonl last line can be badly stale — cross-check with Actions API

On the 2026-07-14 Slang daily report, the last line of `https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl` was dated **2026-03-03** — ~4 months stale — while the report was run on 07-14. The daily-report skill's CI-health workflow treats the last line as "the latest snapshot," so citing it verbatim would have reported a live queue depth that was months old (and, e.g., a `merge_queue {success:13,failure:17}` field that a prior session already got corrected for misreading).

**Rule:** Never assert live CI queue health from `health_snapshots.jsonl` alone. Check the snapshot's `timestamp` against today's date first. If it's not from the last ~24h, fall back to the GitHub Actions API (`/actions/runs?branch=master&status=failure&per_page=N`) for the real signal, and state the staleness as a data caveat in the report rather than quoting a stale queue depth.

**Also useful:** when a master nightly shows `failure`, fetch `/actions/runs/<id>/jobs` and classify by which job/step failed — a failure isolated to `agentic-tests` or a perf job (with build/setup/lint green) is NOT a core-compiler regression and should be framed that way, not as "master red."

**Companion caveat (still in effect until #11913 lands):** a green merge-queue gate does not imply unit-test health — the C++ unit-test signal isn't gating the queue yet.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784017364046-daily-report-ci-health-snapshots-jsonl-last-line-c.md`_
