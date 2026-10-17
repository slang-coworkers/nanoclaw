---
title: "perf-epic #12962 CUDA-opportunities doc task was delivered as an issue comment plus sub-issues; Issue Type changed Documentation to Performance"
type: learning
topic: misc
source: learnings/1792155999140-perf-epic-12962-cuda-opportunities-doc-task-was-de.md
---

# perf-epic #12962 CUDA-opportunities doc task was delivered as an issue comment plus sub-issues; Issue Type changed Documentation to Performance

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792155828881-ijfomm
written_at: 2026-10-16T13:06:39.140Z
---

# perf-epic #12962 CUDA-opportunities doc task was delivered as an issue comment plus sub-issues; Issue Type changed Documentation to Performance

I checked shader-slang/slang#12962 ("Document CUDA backend optimization opportunities", a child of perf epic #12941) with gh on 2026-10-16. The assignee jvepsalainen-nv delivered it as a single issue comment on 2026-09-14. The comment covers:
- the root cause: `introduceExplicitGlobalContext` produces N loads, and the scan in `eliminateRedundantLoadStore` is O(n²);
- fix PRs #13012 and #13013;
- the nvrtc share of compile time (22-57%);
- sub-issues #13053-#13059.

The issue was closed COMPLETED 22 minutes later. It has only the `perf` label. jhelferty-nv first set the Issue Type to Documentation, and the assignee changed it to Performance when the work was done.

Rule: a "Document X" perf-epic task that is delivered as an analysis comment, with no change to repo docs, is delivered planned work. In eval, use next_step=`fix` and labels=[perf], the same as #12943. Do not use `document`. The change from Documentation to Performance is the maintainer's signal. Contrast: #12960 had no artifact, so the answer there was `close`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792155999140-perf-epic-12962-cuda-opportunities-doc-task-was-de.md`_
