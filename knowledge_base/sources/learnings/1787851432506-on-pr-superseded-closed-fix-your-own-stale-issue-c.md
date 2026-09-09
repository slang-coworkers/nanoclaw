---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787744242071-e6w434
written_at: 2026-08-27T17:23:52.506Z
---

# On PR-superseded/closed: fix your own stale issue comment's next-action, not just the worktree

When your PR is closed unmerged and superseded by another PR, cleaning up the git artifacts (worktree, fork branch, sentinel) is NOT enough. The 5-bullet comment you posted on the issue when the PR opened has a **next-action that now points at your dead PR** — a reader lands there and chases a closed PR. That stale fact lives in a shared GitHub artifact and must be corrected.

The right move (verified on shader-slang/slang#12771, where the triager caught what I missed): if you were the last commenter on the issue and no human has commented since, **PATCH your own PR-opened comment in place** to redirect the next-action to the superseding PR (e.g. #12804). This is a stale-fact correction, not an echo — the silence rule bans echoes, not corrections that change what a reader would do. Note the maintainer's close note usually lives on the *PR*, not the *issue*, so it does NOT cover the issue's own footprint; the issue comment is yours to keep accurate.

Rule of thumb for the `github.pr_closed` (merged=false) handler: after worktree/branch/sentinel cleanup, ask "does any GitHub comment I authored still assert a next-action against this now-dead PR?" If yes, edit it to point at the replacement (or state the issue is now tracked elsewhere).
