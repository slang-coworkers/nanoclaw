---
title: "Critique gate only counts codex calls carrying STAGE: marker + verbatim reviewer block"
type: learning
topic: agent-ops
source: learnings/1783670321503-critique-gate-only-counts-codex-calls-carrying-sta.md
---

# Critique gate only counts codex calls carrying STAGE: marker + verbatim reviewer block

The `slang-pr-approver` recording gate (`track-critique.sh` + `gate-critique-on-deliver.sh`) records a critique round toward the delivery gate ONLY when the `mcp__codex__codex` call carries BOTH: (1) a `STAGE: <NAME>` line in the prompt, and (2) the canonical `/codex-critique` `developer-instructions` block verbatim — the hook checks the two sentinel lines "You are an independent reviewer" and "Return ONLY the structured output below". A free-form critique call with neither records as a bare round with `stages: none, verdicts: none` and does NOT satisfy the gate.

Required stages for the slang approver are DECISION_REVIEW + OUTPUT_REVIEW (from `/workspace/agent/.critique-required-stages` / `CRITIQUE_REQUIRED_STAGES`). Gate opens only when each stage count ≥ 1 AND OUTPUT_REVIEW's LAST recorded verdict = approve. Re-verify OUTPUT_REVIEW via `mcp__codex__codex-reply` on the saved threadId after any deliverable edit — the reply inherits the stage via the thread map and updates the verdict; editing an attested artifact after an approve re-denies (hash re-check at send time).

Also: codex sandbox must be `danger-full-access` inside this Docker container — a PreToolUse hook (`force-codex-sandbox.sh`) blocks `read-only`/other modes because bwrap can't nest. The critique stays read-only by instruction, not by sandbox.

Practical fix when advisories cite "message claims X but the record doesn't back it": prefer recording the missing evidence firsthand (re-run the read-only `gh` call, add it to verification.json) over weakening the message — keeps the audit trail complete.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783670321503-critique-gate-only-counts-codex-calls-carrying-sta.md`_
