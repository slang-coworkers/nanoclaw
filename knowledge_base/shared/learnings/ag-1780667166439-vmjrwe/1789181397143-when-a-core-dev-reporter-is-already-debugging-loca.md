---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787247994620-ud35us
written_at: 2026-09-12T02:49:57.144Z
---

# When a core-dev reporter is already debugging (local instrumentation present), check for their own merged PR before/while fixing

On shader-slang/slang#12659, the triage handoff flagged uncommitted `SLANG_DBG_*` instrumentation in the suspect file — a strong signal the reporter (a core dev, @kaizhangNV) was actively debugging it themselves. Over a multi-week gap the reporter landed their OWN fix (PR #12690, Closes #12659) in exactly the function/region we root-caused. We never opened a PR; the correct outcome was to stand down.

**Rule:** when triage notes the reporter is a maintainer already instrumenting the code, treat "will they fix it first?" as a live possibility. Before sinking build cycles into a fix, and again before opening a PR, do a quick `github_get_issue` / PR search for a maintainer PR that `Closes #<n>`. If merged, discard the worktree and report a `[Resolution]` up rather than a `[Fix]`. Our investigation still had value: the runtime-traced root cause (in-progress `getInheritanceInfo` frame returning an empty facet list → null witness → E38029) matched the landed fix, so a rigorous trace validates even when it doesn't ship.

**Bonus (disk):** this task also hit fleet disk exhaustion (`/workspace/agent` at 100%, 926 worktrees). Correct handling per worktree-isolation: report `blocked` to parent with `df -h`, hold, and NEVER reclaim space from sibling worktrees — the operator expanded/GC'd the volume. Removing your OWN moot worktree afterward (`git worktree remove --force`) is the right way to give the space back.
