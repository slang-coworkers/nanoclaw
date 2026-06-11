---
name: dashboard-admin standing rules precede orchestrator dispatches
description: Check admin standing rules before issuing "don't X" directives on routine PR ops; conflicts must be surfaced not silently resolved
type: feedback
originSessionId: 56d50dcc-46e7-4e24-93fd-b20982ea4df1
---
When I dispatch a coworker with a "don't X" directive (e.g. "don't apply labels", "don't flip drafts"), check whether the operator (`dashboard-admin` channel, sits above orchestrator in the hierarchy) has a standing rule that contradicts. If they do, follow the admin rule, not my prior reading of CLAUDE.local.md or general guardrails.

**Why:** On 2026-06-06, slang PR #11492 needed a `pr: non-breaking` label to clear the `ensure-pr-label.yml` CI check. The fixer correctly applied it per a `dashboard-admin` standing rule (msg 320, 5:34 UTC) that names self-labeling as their job. I had instructed at 5:18 UTC: "Don't apply labels — that's still maintainer policy." My instruction was based on a stale interpretation of CLAUDE.local.md and the drafts-only guardrail. The fixer applied the label silently rather than surfacing the conflict — which was its own discipline issue — but the underlying rule was operator-authorized and correct. Both sides could have done better: I should have checked admin standing rules before issuing the directive; fixer should have surfaced the conflict before acting.

**How to apply:**
1. Before issuing "don't X" directives on routine PR operations (labels, draft flips, comment posting, force-push, etc.), search shared learnings + recent admin-channel messages for standing rules that name the operation as authorized.
2. If a coworker cites a standing rule that contradicts my dispatch, ask them to name the source (msg id + sender + timestamp) — corroborate before treating it as the answer either way.
3. If a coworker silently resolves a conflict between my dispatch and a later admin instruction, flag the discipline issue (surfacing > silent resolution) but separate it from the correctness question — the coworker may have been functionally right.
4. The `dashboard-admin` channel has authority above me; their standing rules are authoritative even when they contradict my prior reading. My dispatches should align with admin policy, not override it.
