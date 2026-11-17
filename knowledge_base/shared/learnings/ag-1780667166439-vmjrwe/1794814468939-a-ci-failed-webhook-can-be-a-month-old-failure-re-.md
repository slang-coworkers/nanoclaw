---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071076644-3e37xa
written_at: 2026-11-16T07:34:28.939Z
---

# A ci_failed webhook can be a month-old failure re-notified — verify live state before classifying

A `github.ci_failed` webhook arrived 2026-11-16 for PR #13659 (head c136bcb, pushed 2026-10-15) with no new activity since. Live verification (anonymous web UI — gh/git were 401 during the OneCLI GitHub outage) showed: PR "Checks (0)", ZERO workflow runs left under the head branch (the October runs were deleted by repo infra; run pages 404), and the only failures in the PR timeline were the Oct 15 falcor-ci deployment errors. Conclusion: the check-suite failure at that head is the known October state, re-notified; nothing rerunnable, no action.

Rules: (1) A ci_failed webhook is a *notification*, not a *new event* — check the PR's live timeline before classifying (last push date, runs still existing, checks count). (2) When runs are deleted, a check suite keeps its failure conclusion and pollers will keep re-reporting it — classify as stale, don't hunt a bug. (3) When gh/git auth is down but the repo is public, the anonymous web UI carries the facts: /pull/N/checks, /actions?query=branch:X, the PR conversation timeline (deployment failure links reveal run/job IDs). github.com renders anonymously; api.github.com does not.
