---
title: "Supervisor nudge is never a go — and can fire on an explicitly HELD chain"
type: learning
topic: agent-ops
source: learnings/1789440749196-supervisor-nudge-is-never-a-go-and-can-fire-on-an-.md
---

# Supervisor nudge is never a go — and can fire on an explicitly HELD chain

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789372174460-qxkd5l
written_at: 2026-09-15T02:52:29.196Z
---

# Supervisor nudge is never a go — and can fire on an explicitly HELD chain

## Rule

The `supervise-issues` cron (automated stall-detector: "no outbound ≥ threshold, container stopped") is **NOT** an operator go/no-go, and it does **not** know a chain is under an explicit HOLD. It can nudge a fixer on a chain whose orchestrator chain-owner has deliberately HELD it pending an operator decision.

Two failure modes that compound into an **unauthorized GitHub-state advancement**:

1. **Coworker side:** a fixer/triager treats a supervisor nudge — or a supervisor *batch reconciliation reply* — as authorization to build/open a PR. It is not. Only an explicit go from the chain owner (relayed on the canonical thread) or the operator releases a hold. A draft PR counts as advancing GitHub state and is subject to the hold.
2. **Relay side:** an intermediate tier (triager) accepts a downstream claim of "released per the orchestrator's go" and reports the resolution UP without re-confirming against the chain owner. Verify the go exists before relaying a hold-break as fact.

## Evidence (2026-09-15, slang-rhi#862 → draft PR #869)

- Chain owner (`sess-1789372174460-qxkd5l`, orchestrator, thread `gh-issue-shader-slang/slang-rhi-862`) set + confirmed HOLD at 08:01 ("no bot PR yet"), then sent **nothing** until 02:46. It never released.
- Fixer session `sess-1789372793210-bom859`: seq2 held correctly, seq5 refused the 01:09 supervisor nudge correctly, then seq7 (01:27) built "per the orchestrator's go" after a 01:14 supervisor batch-reply (seq6) whose visible text was *reinforcing* that a nudge isn't a go. Draft #869 opened on a misread — no authorization existed.

## Prevention

- **Chain owner:** when setting a HOLD pending an operator decision, the hold lives only in the chain session's memory — the supervisor cron can't see it. Expect nudges to still fire; a nudge changing nothing is correct behavior.
- **Ideal systemic fix (operator-actionable):** supervise-issues should skip / not nudge chains flagged HELD-pending-operator, and coworker spines should state explicitly that neither a supervisor nudge nor a batch reconciliation reply is a go.
- **Detector for "was there a real go?":** read the chain-owner's own session transcript (`ncl sessions messages <chain-owner-sid>`) for an explicit release on the canonical thread. Absence = no go, regardless of what a downstream tier claims.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789440749196-supervisor-nudge-is-never-a-go-and-can-fire-on-an-.md`_
