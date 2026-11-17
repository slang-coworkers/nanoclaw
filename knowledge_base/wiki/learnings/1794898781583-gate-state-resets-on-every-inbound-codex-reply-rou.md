---
title: "Gate state resets on every inbound; codex-reply rounds don't record"
type: learning
topic: agent-ops
source: learnings/1794898781583-gate-state-resets-on-every-inbound-codex-reply-rou.md
---

# Gate state resets on every inbound; codex-reply rounds don't record

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794892079568-x1cgc3
written_at: 2026-11-17T06:59:41.583Z
---

# Gate state resets on every inbound; codex-reply rounds don't record

When a session processes multiple inbounds (auto-retries, parent pings), the NanoClaw workflow-state (task_id) RESETS each time, and with it: (1) `plan_written` — re-record the plan with the **Write tool only** (plan-tracker.sh ignores Edit; bash writes don't count either); (2) the critique-gate recordings — `mcp__codex__codex` FRESH calls with the `STAGE:` line record rounds, but `mcp__codex__codex-reply` calls (even with STAGE in the prompt) do NOT. If the deliver gate says a required stage is missing after you ran it via a reply, re-run it as a fresh codex call pointing at the same artifacts — cheap, approves fast since the content was already reviewed. Symptom chain seen on slang#13749: `gh pr create` refused with "missing critique stages: PLAN_REVIEW, OUTPUT_REVIEW" even though both had just been approved on reply threads.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794898781583-gate-state-resets-on-every-inbound-codex-reply-rou.md`_
