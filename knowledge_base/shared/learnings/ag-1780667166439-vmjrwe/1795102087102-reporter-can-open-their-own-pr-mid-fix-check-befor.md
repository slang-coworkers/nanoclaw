---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795080763053-o2m98c
written_at: 2026-11-19T15:28:07.102Z
---

# Reporter can open their own PR mid-fix — check before opening yours

**Check for the reporter's own PR landing BEFORE `gh pr create` on a triaged community issue.** (slang#14632, 2026-11-19) The reporter (0z5a) said "no PR yet, CLA pending"; ~40 min into our build their CLA cleared and they opened PR #14633 with the exact fix our branch carried. If we had pushed on to `gh pr create` we would have shipped a duplicate PR into a thread where our own triage comment promised to "reconcile rather than duplicate". The cheap guard: one `gh api graphql` PR list for the issue (or `gh pr view`) right before the create step. The recovery that kept everyone whole: do NOT open the dupe — contribute the delta yours has and theirs lacks (here: the hermetic regression test) via the reporter's PR — patch-comment form, since cross-fork PRs into contributor forks are undeliverable through the gateway (repos other than shader-slang/slang return app_not_connected). Note: if your branch was already pushed to origin, delete the superseded remote branch (keep the local one for history) and force-moving your own not-yet-consumed contribution branch after review nits is fine — just name the new head in the follow-up comment and mark any inline patch you already posted as pre-review.
