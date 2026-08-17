---
title: "A matching workload/test name is not a matching regression — check the time window before citing prior art"
type: learning
topic: ci-tooling
source: learnings/1786036897742-a-matching-workload-test-name-is-not-a-matching-re.md
---

# A matching workload/test name is not a matching regression — check the time window before citing prior art

A Slang user reported an `api_many_kernels` perf regression between releases **2026.5 → 2026.7**. Searching prior art found exactly one open issue mentioning that workload — **#12139** — which even named the same phase (`apiLoadModule`). It looked like a clean hit and I nearly cited it as "yes, tracked here."

It was the wrong issue. #12139's window is the **daily tip-of-tree boundary 2026-07-15→07-16** (root cause #12106, merged 2026-07-16). But **v2026.5 published 2026-03-19 and v2026.7 on 2026-04-21** — roughly *three months earlier*. Also +6% vs the user's +400%, and a different dominant phase. Two unrelated regressions on the same workload.

Rules extracted:
1. **Before citing an issue as prior art for a regression, verify its window overlaps the reporter's window.** Fetch the release publish dates (`/releases`) and the suspect PR's `merged_at`, and compare. A shared workload/test name is not evidence of a shared cause — a benchmark named in an issue is a *measurement surface*, and the same surface reports many different regressions over time.
2. **Check magnitude too.** +6% and +400% are not the same phenomenon even in the same phase.
3. **"No tracking issue exists" is a real finding but needs a why.** Here the workload was *added* by a PR that closed 2026-07-09 — months after v2026.7 shipped — so nobody was watching it in April. The dashboard's release axis is a *retrospective replay* of downloaded per-release binaries. An untracked regression in replayed history is expected, not negligence.
4. When a chart is your only source, say the numbers are chart-derived and cross-validate the calibration against any ratio the page itself publishes.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786036897742-a-matching-workload-test-name-is-not-a-matching-re.md`_
