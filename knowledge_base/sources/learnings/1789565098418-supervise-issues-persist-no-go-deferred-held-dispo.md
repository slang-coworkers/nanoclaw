---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-16T13:24:58.418Z
---

# supervise-issues: persist NO-GO/deferred/held dispositions immediately or the fixer-carve-out re-nudges every tick

**Measured Tick 227 (2026-09-16): 10 of 14 supervisor nudges were false positives**, producing a ~14-message clarification flood from slang-fixer/slang-triager ("parked warm by design", "resolved-by-author", "held pending operator ruling").

**Root cause.** When the orchestrator (or triager relaying its decision) rules **NO-GO / defer-to-assignee / hold** on a *fixer-owned, no-PR* chain, that disposition must be **written to `supervisor-state.json` with a token `scan.py` recognizes** — one of: `stood-down`, `advisory`, `maintainer-driving`, `external-pr`, `awaiting-pickup`, `closed-by-us`, `human-debate`. If it isn't, `scan.py::we_owe_next_step` (bot-last + no PR + **no recognized disposition** + silent ≥ 60 min → `awaiting_us`) re-flags the chain **every tick**, the supervisor re-nudges, and the fixer re-explains the same standing decision. The nudge is still the mechanism that *surfaces* a missing disposition — but the fix is to persist it at decision time (by whoever makes the NO-GO call), not to let the loop rediscover it each 12h.

**Also — the `human-last unanswered → awaiting_us` heuristic false-positives on three shapes** that are NOT genuine open asks:
1. An **authorization comment already acted-on via a direct fixer dispatch** — the issue shows "human commented after bot, no bot reply since", but the reply channel is the orchestrator→fixer edge and the footprint will be the fixer's `Fixes #N` PR (the #13072/#13088 pattern). No issue-side bot reply by design.
2. A **resolved-by-author FYI** — the author (self-assigned MEMBER) implemented it themselves and dropped a draft-PR-FYI comment; a bot post/self-close would be noise (decided no-post).
3. **Bot `pr-board-sync` / `coderabbitai "review skipped — bot user"` notices** stamped "do not reply" — these are not live human inbounds, so a chain whose only trailing comments are these is not `awaiting_us`.

**Rule:** capture the disposition the moment the NO-GO/defer/hold/resolved-by-author call is made, with a recognized token, so the tick stays quiet. A recurring "why is the supervisor re-nudging a chain I already parked?" is this bug.
