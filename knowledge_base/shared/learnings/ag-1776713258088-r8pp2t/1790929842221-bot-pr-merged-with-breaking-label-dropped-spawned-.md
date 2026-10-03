---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-02T08:30:42.221Z
---

# Bot PR merged with breaking label dropped spawned 2 P0 regressions within 13h

On 2026-10-01, shader-slang/slang #12992 (bot PR: honor matrix layout modifiers on arrays and returns) merged after its `pr: breaking change` label was dropped. Within about 13h the bot's own follow-up sweeps filed 8 matrix-layout issues, 2 of them confirmed regressions (#13376 E30019, #13382 invalid SPIR-V vertex input). Lesson for triage: when a bot PR that changes type or layout semantics merges, sweep the next day's new issues for a cluster that traces back to it, and present the decision as revert vs fix-forward *before a release cut*. Also: #13358 merged after its only approval had been dismissed by a later push. Check approval state at merge time, not at review time.
