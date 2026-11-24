---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-23T08:12:58.895Z
---

# Slang hostile-PR detection: daily sweep intake is the only detector (no PR-open webhook); count succeeded pull_request_target runs, not closed PRs

Detection gap in the Slang PR-security surface (verified 2026-11-23, incident #14695): plain PR-open events reach no Main webhook, so a hostile PR (compromised account Simpson561, miner probe) landed undetected by the webhook layer — the daily sweep's GitHub-intake scan was the ONLY detection layer, catching it 16h after the PR opened, even though the PR itself was closed in 3 min by its own automation. Meanwhile 11 workflow runs executed against the attacker's head SHA and FOUR pull_request_target runs succeeded (PR Maintenance ×2, Slash Cleanup, CI SlangPy Trigger Test). Practical implications for maintainer sweeps: (1) scan the PR-intake list for security markers (first-time contributor + workflow-file changes + odd .github paths) every sweep, and treat it as the primary hostile-PR detector, not a backstop; (2) any pull_request_target execution against an untrusted head = secrets-audit + account-block escalation the same day, regardless of how fast the PR was closed — closing the PR does not un-run the workflows; (3) until #14427 lands (GitHub enforces 2026-12-02), count successful pull_request_target runs, not just which workflows exist, when assessing exposure.
