---
title: "[approver/critique-mustfix] codex-critique-gate-requires-canonical-developer-instructions-verbatim"
type: learning
topic: review-approval
source: learnings/1784329350850-approver-critique-mustfix-codex-critique-gate-requ.md
---

# [approver/critique-mustfix] codex-critique-gate-requires-canonical-developer-instructions-verbatim

**Symptom:** Two `mcp__codex__codex` critique calls for the #12131 decision both returned clean `approve` reasoning, but `track-critique.sh` recorded "stages: none; verdicts: none" — the delivery gate stayed closed and `record_decision` would have been blocked. A third call that added `STAGE: DECISION_REVIEW` to the prompt was ALSO rejected ("developer-instructions do not match the canonical /codex-critique reviewer block").

**Root cause:** The critique-gate hook (`/app/hooks/track-critique.sh` + `gate-critique-on-deliver.sh`) records a stage round only when THREE things are all present on the codex call:
1. A `STAGE: <NAME>` marker as the first line of the **prompt** (grepped: `STAGE:[[:space:]]*[A-Z_]+`).
2. The **developer-instructions** field matches the canonical `/codex-critique` reviewer block VERBATIM — it checks sentinel lines "You are an independent reviewer" and "Return ONLY the structured output below". A hand-written critique prompt (even a good one) with different developer-instructions does NOT count.
3. The codex **response** contains a `### Verdict` heading followed by `approve` | `must-fix` (the awk parser keys on `^###[ \t]*verdict`). Codex must be instructed (via the canonical block's output template) to emit `### Verdict` + `### Attested` sections.

Required stages for slang-pr-approver: `CRITIQUE_REQUIRED_STAGES=["DECISION_REVIEW","OUTPUT_REVIEW"]`. Gate passes only when both have count≥1 AND OUTPUT_REVIEW's last verdict = `approve`.

**How to catch it:** After each critique call, the PostToolUse system-reminder tells you exactly what was recorded ("Critique round N recorded (stages: …; verdicts: …)") or why it was rejected. If it says "stages: none" or "NOT recorded", your call was malformed — don't proceed to `record_decision`.

**Fix:** Read `/home/node/.claude/skills/codex-critique/SKILL.md` and copy its **## developer-instructions** block verbatim into the `developer-instructions` param; put `STAGE: DECISION_REVIEW` (then `STAGE: OUTPUT_REVIEW`) as the first prompt line; give codex real FILE artifacts to read + `sha256sum` (the `### Attested` hashes bind the approve — the gate re-hashes at delivery and denies if the file changed after the approve, so don't edit the deliverable/derivation files after their OUTPUT_REVIEW approve). Also: codex MCP requires `sandbox: "danger-full-access"` in this container (bwrap fails in Docker; a PreToolUse hook rejects "read-only"). And the `[Approval Decision]` marker requires `in_reply_to=<inbound id>` on `send_message` (chain-routing gate), else it's blocked.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784329350850-approver-critique-mustfix-codex-critique-gate-requ.md`_
