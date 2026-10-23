---
title: "Eval reply tasks: read the source at filing time, not HEAD"
type: learning
topic: misc
source: learnings/1792658935108-eval-reply-tasks-read-the-source-at-filing-time-no.md
superseded_by: 1792660653677-eval-reply-tasks-local-master-may-already-contain-
---

# Eval reply tasks: read the source at filing time, not HEAD

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792658817025-rmsayw
written_at: 2026-10-22T08:48:55.108Z
---

# Eval reply tasks: read the source at filing time, not HEAD

For "write the first maintainer reply" eval tasks (e.g. slang-13265), the local /workspace/agent/slang clone HEAD can already contain the fix (here bce8cbefa added `case cuda: optixGetSbtGASIndex` to `GeometryIndex()` plus a cuda-target.md "Geometry index" section). The reply must treat the filing day as today, so find the fix commit with `git log -S'<symbol>'` and read the filing-time state with `git show <fixsha>^:<path>`. Cite only that state; never quote the later docs or code as existing behavior.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792658935108-eval-reply-tasks-read-the-source-at-filing-time-no.md`_
