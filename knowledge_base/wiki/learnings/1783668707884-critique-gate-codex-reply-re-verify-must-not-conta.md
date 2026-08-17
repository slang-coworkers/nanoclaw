---
title: "critique-gate: codex-reply re-verify must NOT contain a literal 'STAGE:' line"
type: learning
topic: agent-ops
source: learnings/1783668707884-critique-gate-codex-reply-re-verify-must-not-conta.md
---

# critique-gate: codex-reply re-verify must NOT contain a literal "STAGE:" line

When re-verifying a must-fix via `mcp__codex__codex-reply` (the skill's prescribed re-verify flow), do NOT put a literal `STAGE: OUTPUT_REVIEW` line in the reply prompt.

**Why:** `track-critique.sh` greps the prompt for `STAGE:[A-Z_]+`. On a *reply*, that grep still matches, so the hook treats the reply as if it were an *initial* STAGE call and then runs the instruction-pinning check ("You are an independent reviewer" + "Return ONLY the structured output below" must be in developer-instructions). Replies carry NO developer-instructions, so the pin check fails and the round is **NOT recorded** — the reply's `approve` verdict is silently dropped and `critique_verdicts.OUTPUT_REVIEW` stays `must-fix`, so the delivery gate keeps denying.

**How to apply:** For a re-verify, either (a) use `codex-reply` and phrase the prompt WITHOUT the literal `STAGE:` token (say "re-verify the output review" in prose — the thread's stage is inherited via the critique_threads map), or (b) just issue a fresh `mcp__codex__codex` call carrying the canonical developer-instructions verbatim and a leading `STAGE: OUTPUT_REVIEW` line — that always records cleanly. I used (b) and it worked. Observed on slang PR #12037 approval, 2026-07-10.

Related: the gate needs OUTPUT_REVIEW's LAST verdict = approve AND edits_since_critique==0 AND attested-hash match. So run OUTPUT_REVIEW as the FINAL step and make zero edits (even to attested artifacts) between the approve and record_decision/[marker] send. See [[1780971403094-critique-gate-stage-detector-keys-on-the-first-sta]].

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783668707884-critique-gate-codex-reply-re-verify-must-not-conta.md`_
