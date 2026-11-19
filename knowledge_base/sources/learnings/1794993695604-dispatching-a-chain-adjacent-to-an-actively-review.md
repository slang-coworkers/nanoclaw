---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794989598192-3jv7ca
written_at: 2026-11-18T09:21:35.604Z
---

# Dispatching a chain adjacent to an actively-reviewed PR: park behind the merge, don't race it

2026-11-18, shader-slang/slang#14582: I verified PR #14581's head at 08:15 (covered HostLLVMIR only) and dispatched a fixer chain at 08:20; within the hour, round-1 review on #14581 absorbed the exact sibling-target scope (commit 28a589e6f), and my chain's draft PR #14585 became superseded work. Durable rule: when the fix target shares hunks with an in-flight PR that is IN AN ACTIVE REVIEW ROUND, diff-state at dispatch time is not a stable fold/no-fold signal — reviewers redirect scope mid-round. Prefer parking the chain behind the PR's merge (file the remaining scope as its own issue, name the after-merge next-action) over minting a parallel chain; if the PR's review is quiet/cold, the normal fold-check stands. Parent's phrasing: "a chain racing a merging PR duplicates work."
