---
title: "Diff for substance before re-routing the Nth synchronize of a stuck PR-approver loop"
type: learning
topic: agent-ops
source: learnings/1789554413155-diff-for-substance-before-re-routing-the-nth-synch.md
---

# Diff for substance before re-routing the Nth synchronize of a stuck PR-approver loop

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786376207829-vsrykw
written_at: 2026-09-16T10:26:53.155Z
---

# Diff for substance before re-routing the Nth synchronize of a stuck PR-approver loop

**Context (shader-slang/slang#12136, Jul–Sep 2026):** a fork PR fired 8 `pr_ready_for_review`/`synchronize` webhooks. Each had a genuinely new head (not a re-fire), but from R5 on the approver chain was confirmed degraded on three receipt-backed axes:

1. **Reports don't reach the orchestrator** — the approver's own OUTPUT_REVIEW critique gate blocked its handoff message 3× (session seq 64/66); R5/R6 decisions existed but only found by reading its session.
2. **Ledger can't record** — `APPROVAL_LEDGER_WRITERS` unset (host-side) → every `record_decision` denied for 35+ days.
3. **Fork head → correct-but-identical abstain** — `isCrossRepository:true`, so the approver correctly abstains `CLAUSE_FAIL:head_provenance` in shadow mode (empty policy mount). Right verdict, same on every push.

**Trap:** mechanically routing every synchronize because "the head advanced, so it isn't a re-fire." True but irrelevant — a new head that is **pure rebase churn** (`.github/`, `docs/generated/`, `CMakeLists.txt`, `.gitmodules`) with the **reviewed code byte-identical** carries no new information, while each route costs a full Devin+bot-harvest cycle that can only reproduce the prior abstain.

**Heuristic — before re-routing the Nth synchronize of a loop you've already diagnosed as degraded:**
- `gh api repos/O/R/compare/<lastHead>...<newHead> --jq '.files[].filename'` and check the **reviewed area specifically** (here: the `slang-language-server.cpp` gap sites — goto-def allowlist + `getBuiltinModuleSource`).
- Substantive change (touches the reviewed code / prior finding) → route; verdict may legitimately flip.
- Churn-only + prior blocker unresolved → **hold**, don't burn the cycle. Notify the operator with a one-tap override. The hold is **self-resolving**: keep diffing each push, route the first that touches substance. This is a diffed, logged, reversible hold with the decision escalated — NOT silently dropping the event.
- Never *permanently* suppress a review-event class unilaterally — that's the operator's call. Hold + escalate + offer override; resume on operator ruling OR first substantive push.

**Detector — "were my dispatches even processed?"** An approver group can have ~5000 sessions, so `ncl sessions list --agent-group <id>` at `--limit 2000` silently omits older rows. Use `--limit 5000` and grep the PR number across ALL groups. The single reused session per canonical thread carries `last_active` pinpointing which dispatch it last ran; `ncl sessions messages <sid> --limit 400 | tail` reveals verdicts that never reported up.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789554413155-diff-for-substance-before-re-routing-the-nth-synch.md`_
