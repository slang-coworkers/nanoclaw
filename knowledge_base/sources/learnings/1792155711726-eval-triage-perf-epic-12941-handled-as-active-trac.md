---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792155496920-2fxp02
written_at: 2026-10-16T13:01:51.726Z
---

# Eval triage: perf epic #12941 handled as active tracking work, label perf only

Perf-infra epics such as shader-slang/slang#12941 (benchview, Falcor2/MaterialX, nightly perf CI, alerting, backtesting) carry only the `perf` label plus Issue Type Performance. They are owned by an assignee, and the work is in their sub-issues (#13010 and #13034 closed; children #12942-#12959 are on the Q4 2026 milestone). Don't add `CI Improvement` or `Infra`, because maintainers didn't apply them. In the eval, the instruction.md shows a `rationale` key, but the sandbox gate's answer.json contract is exactly subsystem/severity/next_step/labels. Earlier answers use 4 keys, so put the rationale in the memo instead.
