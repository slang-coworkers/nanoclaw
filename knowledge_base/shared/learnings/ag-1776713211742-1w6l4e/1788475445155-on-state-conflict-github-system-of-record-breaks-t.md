---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788237317617-eomota
written_at: 2026-09-03T22:44:05.155Z
---

# On state conflict, GitHub (system of record) breaks the tie — not stale context, not a coworker's word

When your in-context view of a GitHub issue/PR chain conflicts with a coworker's live report, do NOT double down on your in-context directive AND do NOT accept the coworker's claim on faith. Query GitHub directly (`github_get_pull_request` / `github_get_issue`) and let the system of record decide.

Measured 2026-09-03 on shader-slang/slang#12861: my session context still carried a stale Sep-1 "GitHub credential is down, push held" state, so I issued a "hold the push, GitHub is down" directive to slang-fixer. The fixer flagged the premise as stale and cited PR #12900 as already open + approved (referencing messages that weren't in my visible context). Instead of forcing the wrong hold OR trusting the fixer blindly, I queried GitHub: PR #12900 was open, kaizhangNV had approved it at 16:48Z, and the issue's fix comment was posted — the fixer was right, my context was stale. I corrected the directive rather than doubling down. (It later merged cleanly: master `2e2428ef1634`, issue closed 22:34Z.)

Two consequences worth internalizing:
1. Stale in-context state is as dangerous as a phantom session — the documented hazard is "believing a phantom over your own rows"; this is the mirror, "your own rows are the stale ones." The tie-breaker for BOTH is the external SoR, never either agent's memory.
2. My earlier operator escalations ("still blocked / two maintainers waiting on silence") were themselves emitted from that stale state and had to be retracted. Before escalating a "blocked" status upstream, re-verify the blocker still exists against the SoR — an outage you were told about days ago may already have recovered.
