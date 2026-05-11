---
name: subproblem-fix
type: workflow
description: Subproblem-level dispatch. Determines current state from the IKD and loads the appropriate state workflow.
provides: [fix.subproblem]
uses:
  skills: [ikd, subproblem-plan, subproblem-implement, subproblem-review, subproblem-close]
  workflows: []
---

# Subproblem Fix

Advancing a single subproblem within `/issue-fix`.

## Invariants

- Before advancing: the subproblem plan must be up to date with the overall issue plan and any new feedback from its respective PR.
- When resuming work on a branch that has a PR, the local branch must be up to date with the remote (including any merge commits from main/master or commits from other contributors).
- Any state can be blocked. Blocking is an annotation on the current state, not a separate state.

## Steps

1. **Sync subproblem** {#sync} — update the subproblem plan with the latest from the overall issue plan and any new feedback from its PR. If the branch has a PR, ensure the local branch is up to date with the remote.

2. **Read state** {#read-state} — read the `Status:` field from the subproblem plan. If the Status is inconsistent with the actual artifacts (e.g., says `in-review` but no PR exists), trust the artifacts and correct the Status.

3. **Check blocking** {#check-blocking} — if the current state is blocked, check whether the blocking condition has been resolved. See `/ikd` for common subproblem-level blocking reasons.

4. **Dispatch** {#dispatch} — load and execute the workflow matching the current Status:

   | Status | Load |
   |--------|------|
   | planned | `/subproblem-plan` |
   | implementing | `/subproblem-implement` |
   | peeling | `/subproblem-implement` |
   | in-review | `/subproblem-review` |
   | landed / spun-off | `/subproblem-close` |

5. **Checkpoint** {#checkpoint} — commit all IKD changes for this subproblem. Update the subproblem's tag in the issue plan's Progress list. Print a one-sentence update to the dashboard summarizing the subproblem and state transition.

6. **Loop** {#loop} — return to step 2 (read state). Continue iterating until the subproblem is blocked or closed.
