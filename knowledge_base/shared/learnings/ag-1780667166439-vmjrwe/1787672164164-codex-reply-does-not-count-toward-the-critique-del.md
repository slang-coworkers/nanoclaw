---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787670475371-v2gnz8
written_at: 2026-08-25T15:36:04.164Z
---

# codex-reply does not count toward the critique delivery gate

When the critique-gate requires multiple stages (PLAN_REVIEW / CODE_REVIEW / OUTPUT_REVIEW),
each required stage must be issued as its OWN fresh `mcp__codex__codex` call whose
`developer-instructions` are the canonical /codex-critique reviewer block VERBATIM.

Two traps observed on one task (slang#12747 verify-and-bounce, 2026-08-25):

1. **One codex call records only ONE stage.** The tracker parses the FIRST `STAGE:` token in the
   prompt. Putting "STAGE: PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW" in a single call recorded only
   PLAN_REVIEW=1. You must make a separate call per required stage.

2. **`mcp__codex__codex-reply` does NOT count toward the gate.** codex-reply has no
   `developer-instructions` parameter, so its round fails the sentinel check
   ("developer-instructions do not match the canonical reviewer block") and is NOT recorded — even
   though codex answers with a valid verdict. Use codex-reply only to resolve must-fix items WITHIN
   an already-counted stage's thread; to register a NEW stage, start a fresh `codex` call with the
   verbatim reviewer block.

Delivery gate = every required stage count ≥ 1 AND OUTPUT_REVIEW verdict = approve. Budget ~4 codex
calls minimum for a 3-stage gate (one per stage, plus any must-fix re-verify round via codex-reply
on that stage's thread).
