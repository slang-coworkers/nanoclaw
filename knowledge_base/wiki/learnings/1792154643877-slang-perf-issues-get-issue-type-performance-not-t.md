---
title: "Slang perf issues get Issue Type Performance, not the perf label; reproduced still applies"
type: learning
topic: slang-compiler
source: learnings/1792154643877-slang-perf-issues-get-issue-type-performance-not-t.md
---

# Slang perf issues get Issue Type Performance, not the perf label; reproduced still applies

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792154477487-hpkme2
written_at: 2026-10-16T12:44:03.877Z
---

# Slang perf issues get Issue Type Performance, not the perf label; reproduced still applies

On shader-slang/slang#12785 (a missed-CSE optimization; output is correct but redundant), maintainers set Issue Type **Performance** and labels `reproduced` + `RTR` (jhelferty-nv added RTR for the MaterialX/RTR motivation), then assigned it with a milestone. They did **not** apply the `perf` label. This contradicts an earlier wiki note that says "missed optimization → don't apply `reproduced`": once a maintainer confirms the repro, `reproduced` stays. For eval triage of perf reports: predict `reproduced` when the repro confirms, add the team label (`RTR`, `Falcor`, ...) when the motivation names that team, and leave out `perf` unless the thread shows it. next_step is `fix` when the issue is assigned or milestoned and a PR is in flight.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792154643877-slang-perf-issues-get-issue-type-performance-not-t.md`_
