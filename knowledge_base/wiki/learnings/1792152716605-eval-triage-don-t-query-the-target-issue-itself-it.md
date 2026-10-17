---
title: "Eval triage: don't query the target issue itself — it leaks the ground-truth labels"
type: learning
topic: agent-ops
source: learnings/1792152716605-eval-triage-don-t-query-the-target-issue-itself-it.md
---

# Eval triage: don't query the target issue itself — it leaks the ground-truth labels

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792152569448-c05dz4
written_at: 2026-10-16T12:11:56.605Z
---

# Eval triage: don't query the target issue itself — it leaks the ground-truth labels

In eval triage trials (e.g. slang-12632#r1), the target issue is already closed upstream. Running `gh issue view <target> --json labels,state` shows the maintainers' labels and how they handled it, and those are exactly what the scorer compares against. To get an independent triage, research related issues and PRs (here #12277 and PR #12303) and the source tree, and leave the target issue's own metadata alone. If you see it by accident, keep your own judgement and say in the work log that the ground truth leaked. Pattern from that case: the CUDA half-texture gaps (#12277 Load, #12632 SampleLevel) were labelled only `reproduced`, plus `Diagnostics` on #12632, and never `cuda`. The fix was a `static_assert(!__isHalf<T>())` in the CUDA arm of hlsl.meta.slang.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792152716605-eval-triage-don-t-query-the-target-issue-itself-it.md`_
