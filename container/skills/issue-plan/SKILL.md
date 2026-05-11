---
name: issue-plan
description: "Issue state: plan. Build plans, decompose into subproblems, run plans review, create status comment."
provides: [fix.issue.plan]
---

# Issue — Plan

Build the issue plan and subproblem plans. Planning is complete when all subproblem plans exist, decomposition and sequencing are internally consistent, and the most recent plans review has no unresolved findings.

## Invariants

- For slangpy→slang decomposition: use slangpy's cached shader output as the slang repro, not a hand-written shader.
- Creating new GitHub issues from decomposition requires maintainer approval; in local mode, the operator may approve.
- When a subproblem is in `[peeling]` state, do not modify the parent subproblem's plan or implementation based on the in-flight peeled chunk. The parent's proof-of-concept PR remains the source of truth until the chunk lands (see GitHub Policy, peel-and-land).

## Steps

1. **Set up environment** {#setup-env} — for each involved repository, check out main/master unless a PR branch already exists for this issue (if multiple branches exist, default to the proof-of-concept). Track which branch each repository is on — the issue plan must reflect the current state of each repository so that work-in-progress changes on a branch are not mistaken for code already landed on main/master.

2. **Root cause analysis** {#rca} — investigate and document the root cause in the issue plan.

3. **Search related issues** {#related-issues} — search for open issues that overlap with or address part of the same problem. For small overlap (<50 source lines projected), note and proceed independently. For significant overlap, present options to a maintainer (or the operator in local mode) — depend on the existing issue or proceed independently. Prioritize candidates with approved PRs or recent activity.

4. **Decompose into subproblems** {#decompose} — break the issue into subproblems. Create a subproblem plan (see `/ikd` template) for each. If the fix crosses repositories with their own test infrastructure, decompose into per-repo subproblems. Can also decompose if directed by a human.

   **Cross-repo integration dependencies:** When decomposing, check what the target repo depends on — inspect its git submodules and build configuration. If the fix requires changes in a dependency repo, determine the integration mechanism (git submodule pointer or binary release version) and flag it in the issue plan. By default, create a separate subproblem for updating the submodule pointer or binary release version — this may be handled by a maintainer rather than the agent. Block the downstream subproblem on it. A maintainer may direct that the integration update be folded into another subproblem instead of kept separate.

5. **Run plans review** {#plans-review} — run `/review-plans`. Address all findings. Repeat until no unresolved findings remain.

6. **Create status comment** {#status-comment} — when planning completes for the first time, create the issue status comment (GitHub Policy).

7. **Update status** {#update-status} — set the issue plan's Phase to `implementing`. Update the Progress paragraph to reflect that planning is complete and implementation is beginning. The subproblem list should now be populated with all subproblems tagged `[planned]`.
