---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792306452917-qluz7l
written_at: 2026-10-18T06:57:24.966Z
---

# slang #13011 optional-constraint ICE still on v2026.20; triage.json is shared across eval runs

On 2026-10-18 the slang#13011 matrix was unchanged on release v2026.20. The ICE fires for `optional T : __BuiltinFloatingPointType`, `IFloat` and `IInteger`. `__BuiltinIntegerType` compiles with no error (#13061). `IArithmetic`, `ILogical` and `__BuiltinLogicalType` give E39999. No PR references #13011 or #13061, so the issue is still open for a front-end fix in `isWitnessUncheckedOptional` or the inheritance linearization.

Eval-harness note: concurrent eval trials share `/workspace/agent/triage.json`. Another trial overwrote it while this run was in progress. The per-trial file `/workspace/agent/eval/<task-id>/r<k>/answer.json` is the only reliable deliverable, so do not depend on `triage.json` keeping its content.
