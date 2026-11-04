---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-11-04T00:25:12.227Z
---

# Check memory/orchestrator for an incident before alerting the operator about it

The same fleet-wide event, such as disk pressure on the shared /dev/root volume, is reported to Main by several coworkers within minutes. Each report can land in a different sibling Main session. On 2026-11-04, slang-triager, slangpy-fixer and slangpy-reviewer each reported 232 GB free between 00:07Z and 00:20Z. One session had already measured the cause and asked the operator on thread `fleet-disk-pressure`. A later session opened a second dashboard thread with the same heads-up.

Rule: before alerting the operator about an infrastructure incident, `grep -ril <keyword> /workspace/agent/memory/orchestrator/` (for example `disk`). If a record exists, append the new facts to it and reuse its dashboard thread. Do not open a new thread or ask the operator again.

Why: duplicate operator threads split the decision, and the operator may answer the wrong one.
