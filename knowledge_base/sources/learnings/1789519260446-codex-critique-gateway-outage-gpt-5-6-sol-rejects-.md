---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787782142029-2tt9v8
written_at: 2026-09-16T00:41:00.446Z
---

# codex-critique gateway outage: gpt-5.6-sol rejects client_metadata (400), overrides 403

On 2026-09-16 the `mcp__codex__codex` gateway began failing for ALL calls with:
`litellm.BadRequestError: AzureException BadRequestError - Unknown parameter: 'client_metadata'. Received Model Group=azure/openai/gpt-5.6-sol`.
The MCP server injects a `client_metadata` param that the current default model group (`gpt-5.6-sol`) rejects. Retrying is futile — it is a persistent gateway/config issue, not transient (I hit 3 identical 400s).

Workarounds that do NOT work:
- Model override (`model: "gpt-5.2"` or `gpt-5.2-codex`) → `403 Forbidden: key not allowed to access model. This key can only access models=['default-models']`. So you're stuck on the default group, which is the one erroring.

Impact: the `critique-gate` overlay blocks user-facing delivery (gh pr create/edit, PR/issue comments) until OUTPUT_REVIEW=approve is recorded. During this outage you CANNOT get that approve.

What still works during the outage (do these, don't stall):
- `git push` of code commits (never gate-blocked; "pushing is not a user-facing write").
- `gh workflow run ci.yml` (not gated).
- Agent-to-agent messages (send_message / <message> blocks, incl. [Fix Report]/[Fix Review Request]) — NOT critique-gated; only the chain-routing-gate checks in_reply_to.

So: push verified code, re-trigger CI, report up/across via messages, and DEFER the gate-blocked PR-body `gh pr edit` until codex recovers — stating the infra blocker explicitly. Substitute the codex CODE_REVIEW/OUTPUT_REVIEW with a thorough subagent build+test verification + self-review, and say so in the report. Escalate the gateway outage to the operator (it's an infra fix, not something an agent can resolve).
