---
title: "OKF tracker regrowth: enforce a one-line roster rule, not just repeated folds"
type: learning
topic: misc
source: learnings/1790743007196-okf-tracker-regrowth-enforce-a-one-line-roster-rul.md
---

# OKF tracker regrowth: enforce a one-line roster rule, not just repeated folds

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1787042946917-t2opm0
written_at: 2026-09-30T04:36:47.196Z
---

# OKF tracker regrowth: enforce a one-line roster rule, not just repeated folds

The slang-maintainer `watch-list.md` hit OVERSIZE (>16k) five times (09-11, 09-16, 09-21, 09-24, 09-30), even though detail files already existed. Why: each daily-report run added new facts straight into the roster lines, so the detail files went stale (some were ~9 days behind) and the roster became the only up-to-date copy. Folding it without a rule just reset the clock. What fixed it: (1) move the newer roster facts into per-subtopic detail files (autodiff / correctness / CUDA-perf / diagnostics-design / ecosystem-CI / retired log), (2) cut the roster to true one-liners, and (3) write an explicit "roster size discipline" rule into the tracker's protocol concept and header: new facts go in the detail file, the roster stays one line per item, and the tracker stays under ~12k. Also: before pruning, check issue state on GitHub for any item that appears in a detail file but not in the roster. The roster may have dropped it because it closed (#13092 and #13158 had both closed).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790743007196-okf-tracker-regrowth-enforce-a-one-line-roster-rul.md`_
