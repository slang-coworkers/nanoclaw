---
name: feedback_record_decision_ok_proves_emission_not_persistence
description: "record_decision returns ok('Decision recorded') with NO writer check in the handler — the host gate runs out of band after the row is consumed. Success string proves EMISSION, never persistence; denial is asymmetric (silence ≠ success). APPROVAL_LEDGER_WRITERS unset ⇒ every approver decision fleet-wide is unpersisted (still unset as of my 2026-09-16 note). OPERATOR ACTION outstanding."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8d73dcb6-6732-47d9-b20e-255818a8fc2b
---

# `record_decision` success ≠ a ledger row · **operator action outstanding**

**08-10, reported by slangpy-pr-approver, corroborated by me in host source.** The approver told me
on 08-03 *"Ledger row keyed `(shader-slang/slangpy, 1068, 266b2072e621…)`"*. No such row exists; the
host denied it: `record_decision denied: no approval-ledger writers are configured (set
APPROVAL_LEDGER_WRITERS)`.

## Mechanism
**Container half** (approver's read, `/app/src/mcp-tools/core.ts:580-604`): the handler validates
args, emits a `messages_out` row and returns `ok('Decision recorded: …')` with no writer check;
`APPROVAL_LEDGER_WRITERS` appears nowhere under `/app`. ⇒ the success string is an **emission
receipt**.

**Host half** (my read of the clone at `/workspace/agent/pr1175/src/`, **not** the running host — so
it corroborates the gate's *shape*; the denial string is authoritative for the live install):
`src/modules/approval-ledger/capability.ts` `isApprovalLedgerWriter()` reads
`process.env.APPROVAL_LEDGER_WRITERS || envConfig.APPROVAL_LEDGER_WRITERS`, comma-split, matched on
group id first then `groups.folder` (case-insensitive). Read through a function, so **no host restart
is needed** once set. The denial text names the branch:

| branch | reason text | scope |
|---|---|---|
| allowlist empty | `no approval-ledger writers are configured (set …)` | **every group** |
| id/folder miss | `agent group <folder> does not hold the approval-ledger writer capability` | that group |

## The feedback is asymmetric
Same args, same environment: seq=5 (08-03T19:49Z) got **no denial, ever**; seq=19 (08-10T11:28:51Z)
was denied 1.3 s later. ⇒ silence was not success ([[feedback_exit_zero_empty_is_not_a_measured_zero]]).
**Reporting rule: say "emitted", never "recorded", until a read-back confirms the row** — adopted by
four approver sessions unprompted by 08-11 (each reported "ATTEMPTED, pending operator action" and
treated the host denial as authoritative over its own success string).

## Scope: standing environment state, not a transient
Branch-1 denials on 08-10/11 across slangpy, slang-rhi and slang, both approver groups, every verdict
class — including 3 `BLOCK`s and 2 `WOULD_APPROVE`s that would have changed an outcome under
enforcement (slangpy#925's BLOCK was dropped on a PR that merged with red wheel legs,
[[feedback_a_loud_defect_recruits_a_fixer_a_quiet_one_does_not]]). My 2026-09-16 learning still
recorded it unset ("every `record_decision` denied for 35+ days"). How to count it without
under-reporting: [[feedback_a_per_session_occurrence_count_is_a_lower_bound]].

## 🔴 OPERATOR ACTION — mine to escalate, not mine to apply
Set `APPROVAL_LEDGER_WRITERS=slang-pr-approver,slangpy-pr-approver` in the host `.env` (ids also
accepted: `ag-1783611156430-vvj8oi` = slang-pr-approver, `ag-1783611156448-d49n0a` =
slangpy-pr-approver). Main cannot set it: `ncl help` exposes no `env` resource and no
`approval_decisions` reader (verified 08-10) — admin ≠ able. Until set:
- Shadow-mode accuracy scoring has **no data**. Don't read an empty `approval_decisions` table as
  "approvers aren't deciding".
- The only durable records are the approvers' `work/<pr>-<sha>/` dirs (`clauses.json`,
  `review/review-doc.md`). A fallback decision file sent to me lands in `/workspace/inbox/<id>/`,
  which has no retention guarantee — move it (e.g.
  `/workspace/agent/approver-decisions/12448-e87cb320422a-decision.md`); nothing reports a file that
  wasn't moved.

**`record_human_verdict` is deliberately unregistered** (`core.ts:608-614`): the host stamps human
outcomes from the webhook, keyed by delivery id. Routing join fields through `record_decision` as a
workaround is wrong. Related: [[feedback_two_sets_same_count_different_members]] (same PR, my error).
