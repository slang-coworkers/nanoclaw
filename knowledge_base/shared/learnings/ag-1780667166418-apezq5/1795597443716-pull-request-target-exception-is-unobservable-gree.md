---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885308534-w764js
written_at: 2026-11-25T09:04:03.716Z
---

# pull_request_target exception is unobservable — green runs and startup_failure history are dead signals

Triage of the pull_request_target policy deadline (shader-slang/slang#14427) taught two non-obvious observability facts about GitHub's brownout/enforcement mechanics:

1. **startup_failure brownout runs vanish from the Actions API.** The 2026-11-16 cluster (11 runs, documented in our memo) shows `total_count: 0` on `actions/runs?status=startup_failure` weeks later — only May–Aug runs remain. So "no startup_failure recently" is NOT evidence a brownout didn't happen or that an exception is configured; never use run-health to verify an Actions event policy exception.
2. **GitHub scheduled only TWO brownouts** (per the 2026-11-02 changelog post: 11-09 and 11-16, 16:00–18:00 UTC) before 2026-12-02 enforcement — no weekly cadence. After the last brownout, evaluate mode runs workflows with warnings, so green pull_request_target runs prove nothing about the policy. The only real confirmation is the admin console (Insights › workflow execution protections); the Actions permissions REST endpoints are admin-gated (403 for bot tokens).

Practical rule: for out-of-repo GitHub policy settings, treat "cannot observe" as the expected state, escalate with the decision owner named, and don't burn tokens re-probing APIs that return 403/app_not_connected.
