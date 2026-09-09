---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787335859644-6gakh8
written_at: 2026-08-21T21:47:33.728Z
---

# [approver/critique-mustfix] keep the human verdict OUT of the review-doc; record_decision needs clauses+challenger; don't inflate "non-bot reviewer" to "maintainer"

**Context:** slang#12670, a clean WOULD_APPROVE. The critique gate (DECISION_REVIEW + OUTPUT_REVIEW via `/codex-critique`) caught three real discipline slips before recording — worth reusing as a pre-critique checklist so they don't cost a round.

**Slip 1 — human verdict leaked into the decision input (DECISION_REVIEW must-fix).**
I synthesized `review/review-doc.md` (the Step-2 verdict-parse target) with the human APPROVE, my Step-3 structural investigation, AND CI analysis mixed in. Contract: the review doc must derive its verdict from harvested-bot/Devin evidence ALONE. `mode=live_late` is only a ledger tag; the human verdict is CALIBRATION/JOIN output, not decision input (SKILL.md input contract). Fix: review-doc.md = Devin (or bot) signal only; challenger evidence lives in `investigation.md`; human signal + CI go under headings explicitly marked "calibration/join only" / "context only, policy doesn't require CI". Rule: **if it's not a harvested bot review or Devin, it does not belong in the review doc's verdict rationale or embedded `_approver_result`.**

**Slip 2 — record_decision omitted mandatory `clauses` + `challenger` (OUTPUT_REVIEW must-fix).**
The `record_decision` MCP tool takes `clauses` (the clauses.json object) and `challenger` (the Step-3 result) as fields; leaving them off shrinks the auditable ledger row below the contract. Also: an absent reason_code must be OMITTED/null, not prose like "(none)". Pass the full clauses object and a structured challenger summary every time.

**Slip 3 — "human maintainer" over-claims what was verified (OUTPUT_REVIEW must-fix).**
I only established the reviewer was NON-BOT and APPROVED at head — not that they are a maintainer. Say "non-bot repository reviewer" / "repository member" unless association was actually queried. (Direction-of-praise-neutral over-claim: a REACH class over-claim about someone else's role — cheap to check, so state only what the evidence shows.)

**Meta-slip (not scored but cost a round):** my first two codex calls used hand-written developer-instructions, so `track-critique.sh` did NOT record the round (it verifies the canonical `/codex-critique` sentinel lines "You are an independent reviewer" / "Return ONLY the structured output below"). **Always invoke the critique via the `/codex-critique` skill's developer-instructions VERBATIM with `sandbox: danger-full-access` and `cwd: /workspace/agent`** — a rewritten block does not count toward the delivery gate even if codex answers.
