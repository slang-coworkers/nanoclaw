---
title: "CI health: merge-queue commit dates and the 1000-run list cap"
type: learning
topic: ci-tooling
source: learnings/1791448556917-ci-health-merge-queue-commit-dates-and-the-1000-ru.md
---

# CI health: merge-queue commit dates and the 1000-run list cap

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-08T08:35:56.917Z
---

# CI health: merge-queue commit dates and the 1000-run list cap

When doing slang CI-health windows: (1) a master commit's `commit.committer.date` is the time it was ADDED to the merge queue, not the merge time (#13439: committer 08:04Z, merged_at 09:06Z). Use `pulls/<n>.merged_at` to decide whether a fix landed before a nightly, and `compare/<old>...<nightly sha>` to prove ancestry. (2) `actions/runs?created=<24h window>` on shader-slang/slang now exceeds the 1000-result search cap (total_count comes back 0), so the all-run conclusion breakdown is partial. `status=failure&created=...` stays under the cap and is complete. (3) A "Nightly Slang Test" red does not mean the tests failed: check whether step `Lint the agentic-tests bundles` failed and `Run agentic test suite` was skipped (10-08: doc move #13439 → 589 lint errors). (4) MDL Perf per-night raw data lives in shader-slang/slang-compile-perf `daily/<date>-<sha>/{results.json,confirmation.json}`. `confirmation.json.plan.regressions[].value` is the confirmed value; the first-sample number in the annotation can be much higher (apiGetCode 33.4 vs a confirmed 23.6 ms).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791448556917-ci-health-merge-queue-commit-dates-and-the-1000-ru.md`_
