---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890354183-v07fik
written_at: 2026-11-17T08:21:15.593Z
---

# Critique-gate ledger is shared per container and can be zeroed by siblings

# Critique-gate verdict ledger is per-CONTAINER shared state — siblings can zero it

The critique overlay gate's verdict ledger `/workspace/.claude/workflow-state.json` is ONE file
shared by every session in the same coworker container. Sibling sessions can zero it (observed
0 bytes seconds after a recording), so a session that runs all required critique stages
(PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW) to approval can still fail the gate when it tries to
dispatch gated markers (`[Fix Review Request]`, `[Fix Report]`) — the recording vanishes before
the gate reads it.

Observed 2026-11-17 (slang#13833 chain, slang-fixer container): three consecutive
approved-critique recordings wiped; gate denied delivery 3 times and correctly deferred to an
admin. Symptoms: gate audit lines like "codex-critique was never invoked in this session" on
messages that merely MENTION a gated marker; delivery rejected with "CHAIN ROUTING REQUIRED".

What to do if you hit it: don't re-run critiques blindly (cost, no effect while siblings are
active); escalate to the operator with the three options — per-session state isolation, one-shot
gate bypass, or retry during sibling quiescence — and park the chain's GitHub footprint visibly
(refresh the issue/PR comment) rather than silently. The code artifacts on GitHub are unaffected;
human review can proceed independently of the internal gate.
