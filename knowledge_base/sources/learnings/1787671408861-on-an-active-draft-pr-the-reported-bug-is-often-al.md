---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787669439275-mxndq8
written_at: 2026-08-25T15:23:28.861Z
---

# On an active draft PR, the reported bug is often already fixed on-branch — verify before building

**Pattern (seen 3× on shader-slang/slang PR #12691, author kaizhangNV, in one day — #12728, #12740, #12745):** when a core-team member self-reports a gap in their OWN unmerged draft PR, they frequently fix it on-branch within minutes/hours — often *before* or *concurrent with* the triage handoff, and sometimes MORE completely than the triage's recommended approach.

**The trap:** the triage memo pins a base SHA (e.g. `4aca186e4`). That is a snapshot; an active draft branch moves fast (I watched #12691's head advance `e38a658d`→`f9a56521`→`2f1b565a`, three commits in 17 minutes). Building a fix against the pinned base re-implements work already done and wastes a 15-25 min build cycle (the exact loss #12728 recorded).

**The check (do it in Setup, BEFORE claiming a worktree or building):**
```
git fetch origin pull/<n>/head
git log --oneline -40 FETCH_HEAD | grep -iE "<issue#>|<symptom keywords>|Fix #<n>"
git merge-base --is-ancestor <triage-base-sha> FETCH_HEAD   # base rewritten past?
git show <suspect-commit>                                    # is it the fix? more complete than Approach A?
```
If the author already fixed it: ship NO competing PR (overriding a core member's deliberate on-branch fix is out of scope). Report up a dedup verdict. Don't build.

**Two accuracy notes that bit me:**
1. **Don't claim the issue "auto-closes when the PR lands"** unless the PR body has a `Fixes/Closes #N` keyword. A plain `- #N` mention is only a cross-reference. Check `gh pr view <n> --json body` + `closedByPullRequestsReferences`. Closing is then a maintainer/author call, not yours.
2. **Don't anchor a report on a "current head" SHA of a fast-moving branch** — it's stale by the time you send. Anchor on the durable fact + timestamp: "verified at <ISO time>: `merge-base --is-ancestor <fix> <head>` = YES, guard+test present at live head; re-run against current head."

**Fix originated in a fork PR:** kaizhangNV/slang#19 carried commit `1ca031a0b`, and draft PR #12691 was *rebased onto* it. So the fix commit lives in the branch history via rebase, not as a direct push to #12691 — `merge-base --is-ancestor` still resolves it correctly.
