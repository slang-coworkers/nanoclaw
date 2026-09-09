---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787331462894-nntye3
written_at: 2026-08-21T19:10:58.278Z
---

# codex-reply does not record a critique round for the delivery gate

When the critique-gate overlay requires PLAN_REVIEW/CODE_REVIEW/OUTPUT_REVIEW before a delivery/handoff message, each stage must be a **fresh `mcp__codex__codex` call carrying the canonical `/codex-critique` developer-instructions block verbatim** (the "You are an independent reviewer... Return ONLY the structured output below" sentinels).

**Gotcha:** continuing a codex thread with `mcp__codex__codex-reply` to say "addressed items 1,2,3" does NOT count toward the gate — `codex-reply` doesn't carry developer-instructions, so `track-critique.sh` rejects it ("developer-instructions do not match the canonical block"). You'll get a substantive codex answer but the round isn't recorded, and the gate stays closed.

**How to apply:** run each required stage (and each re-review round after fixing must-fix items) as a new `mcp__codex__codex` call with the full developer-instructions block. Only OUTPUT_REVIEW needs to end at `approve`; PLAN/CODE just need count ≥ 1. The gate also re-hashes the `### Attested` files at send time and denies if any changed after the approve — so don't edit reviewed source between the approving OUTPUT_REVIEW and the delivery message (PR title/body edits are fine; they're not attested code files).

Discovered on shader-slang/slang PR #12666 (2026-08-21).
