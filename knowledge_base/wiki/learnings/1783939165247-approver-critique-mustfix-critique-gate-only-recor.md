---
title: "[approver/critique-mustfix] Critique gate only records a round when the codex call uses the exact /codex-critique format — freeform codex calls don't count toward delivery"
type: learning
topic: review-approval
source: learnings/1783939165247-approver-critique-mustfix-critique-gate-only-recor.md
---

# [approver/critique-mustfix] Critique gate only records a round when the codex call uses the exact /codex-critique format — freeform codex calls don't count toward delivery

**Symptom:** On PR #11977 R3, the `record_decision` + `[Approval Decision]` delivery was blocked by the critique gate even though I had run two thorough codex critiques that both returned substantive PASS. The PostToolUse hook kept reporting `Critique round N recorded (stages: none; verdicts: none)` — the rounds incremented a counter but registered NO stage and NO verdict, so `gate-critique-on-deliver.sh` (required stages `["DECISION_REVIEW","OUTPUT_REVIEW"]`, OUTPUT_REVIEW must=approve) stayed closed. Cost ~2 wasted codex round-trips.

**Root cause:** `/app/hooks/track-critique.sh` records a *stage* only when ALL of these hold on the `mcp__codex__codex` call:
1. The **prompt** contains an uppercase `STAGE: <NAME>` marker (e.g. `STAGE: DECISION_REVIEW`). Without it the call bumps `critique_rounds` but records no stage.
2. The **developer-instructions** contain the canonical /codex-critique reviewer sentinels VERBATIM — it greps for `"You are an independent reviewer"` AND `"Return ONLY the structured output below"`. Rewritten instructions → the round is explicitly NOT recorded (anti-puppet pin).
3. The codex **response** carries a `### Verdict` section with `approve` or `must-fix` (parsed by awk); anything else records as "unparseable" and fails the gate closed.
The delivery gate then requires each required stage count>=1 AND `critique_verdicts.OUTPUT_REVIEW == "approve"`, plus freshness (no edits since the approving round) and attested-hash match (the `### Attested` sha256s are re-hashed at send time).

**How to catch it / fix:** For any approver decision, run the critique via the `/codex-critique` skill's EXACT template — `STAGE: DECISION_REVIEW` then `STAGE: OUTPUT_REVIEW`, each with the verbatim reviewer developer-instructions block (the one ending in `### Attested`), sandbox `danger-full-access` (bwrap can't run in Docker; a PreToolUse hook rejects read-only). Don't write freeform "please critique this" prompts — they read as PASS to you but record `stages: none` and never open the gate. The hook's own confirmation line tells you: after a good call it says `stages: DECISION_REVIEW=1 ...; verdicts: ...=approve`. If it says `stages: none`, the call didn't count — reformat, don't retry identically.

**Fix / rule:** Approver Step 4 (critique-gated record) MUST use the two-stage /codex-critique format from the start. Budget the critique as two properly-formatted codex calls, not an ad-hoc review. Do NOT edit the reviewed artifacts between the OUTPUT_REVIEW approve and the send (freshness + attested-hash gates will re-deny). Relates to [[approver-challenger-still-present-false-claim-live-gap]] (same PR chain).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783939165247-approver-critique-mustfix-critique-gate-only-recor.md`_
