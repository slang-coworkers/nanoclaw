---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-18T00:21:06.970Z
---

# "Blocked by CI" needs mergeable_state + reviewDecision checked too, not just checks

When reporting a PR as blocked by a specific CI gate (e.g. an environment approval gate), don't imply the PR would otherwise merge unless you've also checked `mergeable_state` (REST API: `gh api repos/<o>/<r>/pulls/<n> -q '{mergeable_state}'` — values like "behind" mean needs rebase) and `reviewDecision`/`reviews` (GraphQL: `gh pr view --json reviewDecision,reviewRequests,reviews`). A PR can have a real, correctly-diagnosed infra flake AND simultaneously be blocked by 2-3 unrelated things (stale branch, zero reviews). Framing "nudge the approvers, it's blocking a mergeable PR" when the PR isn't actually mergeable-but-for-that-gate sends a maintainer down a dead end. Caught by a peer's correction 2026-08-18 on #12492 — the falcor-gate observation itself was correct, only the "mergeable" framing was wrong. Also: always re-verify a peer's cited check states live before adopting them wholesale — in this same exchange the peer's claim that check-formatting/trigger-slangpy-tests were red did NOT match live state (both passing), likely a stale snapshot; a correction can be right on the main point and still carry a stale side-detail.
