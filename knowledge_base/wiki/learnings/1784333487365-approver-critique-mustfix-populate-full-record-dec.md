---
title: "[approver/critique-mustfix] populate full record_decision field set before OUTPUT_REVIEW; ad-hoc codex STAGE calls don't count toward the gate"
type: learning
topic: review-approval
source: learnings/1784333487365-approver-critique-mustfix-populate-full-record-dec.md
---

# [approver/critique-mustfix] populate full record_decision field set before OUTPUT_REVIEW; ad-hoc codex STAGE calls don't count toward the gate

## Symptom
On #12147 R3, two avoidable round-trips near the end of the decision procedure:
1. My first `decision.json` carried only the headline fields (repo/pr/commit/decision/reason_code/review_diff_hash/policy_version). OUTPUT_REVIEW flagged it must-fix: the skill's `record_decision` contract requires the FULL set `{repo, pr_number, commit_sha, mode, decision, reason_code, review_diff_hash, policy_version, clauses, challenger, ts}` — the `clauses`, `challenger` summary, and ISO `ts` were missing.
2. Two of my codex critique calls carried `STAGE: DECISION_REVIEW` / `STAGE: OUTPUT_REVIEW` but used ad-hoc `developer-instructions`. The hook did NOT record them ("developer-instructions do not match the canonical /codex-critique reviewer block"), so they didn't count toward the delivery gate even though they produced useful analysis.

## Root cause
The delivery gate (`gate-critique-on-deliver.sh` + `track-critique.sh`) keys on the VERBATIM `/codex-critique` developer-instructions block (it checks sentinel lines "You are an independent reviewer" / "Return ONLY the structured output below"). And OUTPUT_REVIEW independently checks deliverable completeness against the procedure spec, so a partial `decision.json` fails it.

## How to catch it
- Build `decision.json` with ALL eleven `record_decision` fields (embed `clauses` from clauses.json + a `challenger` summary object + `ts` from `date -u`) BEFORE running OUTPUT_REVIEW, not after.
- For the gated stages (DECISION_REVIEW, OUTPUT_REVIEW), invoke via the `/codex-critique` skill and pass its `developer-instructions` block verbatim. Ad-hoc `mcp__codex__codex` calls are fine for EXPLORATORY reachability checks (they materially refined the #12147 trigger), but they never satisfy the gate — plan on one canonical skill call per required stage on top of any exploratory rounds.
- Also: a chain-delivery-marker message (`[Approval Decision]`, `[Report]`) needs `in_reply_to` set on the tool call or the routing gate blocks it. A standing dashboard status line should NOT carry the marker (drop it — the marker'd decision already routed to the parent).

## Fix
Completed decision.json with clauses+challenger+ts; re-ran both stages through the canonical skill block → DECISION_REVIEW=approve, OUTPUT_REVIEW=approve recorded; gate opened; recorded + sent. No impact on the verdict, only on cycle count.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784333487365-approver-critique-mustfix-populate-full-record-dec.md`_
