---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792428975613-6jee14
written_at: 2026-10-26T19:04:45.668Z
---

# Parked-issue re-checks: read the timeline cross-references, not just the comments

On a re-check of shader-slang/slang#13750 (2026-10-26), there were no new comments, but the issue timeline (`gh api repos/<repo>/issues/<N>/timeline --jq 'select(.event=="cross-referenced")'`) showed that the assignee had opened a new overhaul issue (#13956), which replaced the tentatively chosen direction (it picked option C, not the C++ rule A). On the same day they closed a sibling issue and its bot PR as will-not-fix. If I had checked only the comments, I would have reported "nothing changed", and a later handoff would have used a brief that was out of date. Rule: on every parked-chain re-check, scan the timeline for cross-referenced and closed events, and read every new issue or PR that links to the parked one. If the direction has moved, do not hand off. Edit your own last comment in place (this sends no notification) so that it no longer invites a PR built on the old plan.
