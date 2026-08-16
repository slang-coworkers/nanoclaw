---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786693173788-3j1zsn
written_at: 2026-08-14T11:43:58.048Z
---

# [approver/critique-mustfix] Source-comment must-fix a read-only approver can't clear → ABSTAIN_POLICY:ESCALATED, not WOULD_APPROVE

## Symptom
On slang#12518 (a clean diagnostic-guard *widening*, human-approved at the pinned head), the DECISION_REVIEW critique held a `must-fix` on the **PR author's source comment** (change-history phrasing at `slang-ir-typeflow-specialize.cpp:3503-3523`) through all 3 rounds. Codex conceded "on technical correctness alone, WOULD_APPROVE is supportable" — the block was purely the comment-hygiene rule, not a compiler risk.

## Root cause
The critique gate's comment-hygiene rule fires on any diff under review, including one authored by someone else. But the slang-pr-approver is **read-only**: no GitHub write/edit credential, cannot revise PR source to clear the finding. So the must-fix is structurally unresolvable by the approver, yet the gate forbids recording WOULD_APPROVE over an unresolved must-fix ("never silently passes").

## How to catch it / correct resolution
When a critique must-fix is (a) about the PR's own source rather than your decision derivation, AND (b) something you have no authority to change, do NOT round up to WOULD_APPROVE and do NOT keep re-litigating past the 3-round cap. The skill's soft-cap rule is explicit: "3 rounds with unresolved must-fix → stop, escalate to a human." The terminal state is **`ABSTAIN_POLICY` / reason_code `ESCALATED`** — a critique-gate DEADLOCK, not a code concern. Abstains are NOT critique-gated (early return): record directly.

## Key nuances
- ABSTAIN_POLICY:ESCALATED here asserts "the pipeline couldn't pass the gate," NOT "the code is unsafe." State that explicitly in the row/message so the human isn't misled: no verified 🔴 bug, no real-trigger 🟡 gap.
- The delivery hook `gate-critique-on-deliver.sh` still requires an OUTPUT_REVIEW=approve before it lets an `[Approval Decision]`-marked message through — even for an abstain. So you must still run an OUTPUT_REVIEW on the *final deliverable* (an accuracy check of the abstain report), distinct from the deadlocked DECISION_REVIEW. That one can and should reach approve.
- `record_decision` (the ledger append) is NOT blocked for ABSTAIN_* rows and can be called before the message clears the delivery gate.
- Don't let "human already approved it" tempt you to override the gate — deferring to the file owner is right on the *merits*, but the mechanical resolution is still ESCALATED because the gate itself is what's stuck.
