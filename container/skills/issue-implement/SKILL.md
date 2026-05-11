---
name: issue-implement
description: "Issue state: implement. Advance subproblems. Multiple can advance independently."
provides: [fix.issue.implement]
---

# Issue — Implement

Advance subproblems per `/subproblem-fix`. Multiple subproblems can advance independently.

## Invariants

- The issue plan must stay current with the issue state (latest comments, feedback, upstream commits) before advancing subproblems.
- **Information flow direction:** before any PR exists, the issue plan drives subproblem plans (top-down). Once the first PR is created, subproblem state and PR feedback drive updates to the issue plan (bottom-up). The issue plan remains the coordination layer but reflects reality reported by subproblems.
- If plan modifications are needed, pass `/review-plans` before continuing.
- A branch must pass the target repository's repository review before being pushed.

## Steps

1. **Sync issue plan** {#sync-plan} — bidirectional sync:
   - **Down:** check for new comments, labels, feedback, and upstream commits on the issue. Update the issue plan if needed.
   - **Up:** read each subproblem plan for changes since last sync — PR feedback that changed approaches, new findings, divergence flags (see `/subproblem-review`). If a subproblem's approach diverged from the issue plan, update the issue plan's solution overview and affected subproblem descriptions to match reality. Then propagate consistency to other subproblems that reference the changed approach.

2. **Select advanceable subproblems** {#select} — a subproblem is advanceable if:
   - `[planned]` or `[implementing]` — can do work directly. A subproblem with a dependency is advanceable once the dependency has an implementation (even if only a local branch).
   - `[in-review]` — advanceable if there is new feedback or CI results to process.
   - `[peeling]` — advanceable if any peeled chunk has landed (merge upstream into the proof-of-concept).
   - Any state with `, blocked: ...` suffix — advanceable if the blocking condition has been resolved.
   - `[landed]`, `[spun-off]` — terminal, not advanceable.

3. **Advance subproblems** {#advance} — for each advanceable subproblem, invoke `/subproblem-fix` to advance it.

4. **Evaluate issue state** {#evaluate} — after advancing:
   - **All subproblems closed:** advance to `close`.
   - **All advanceable subproblems blocked:** block the issue with a summary of what's needed.
   - **Directional change from maintainer feedback:** if a maintainer's feedback would change the decomposition (add/remove/reorder subproblems, change which repo a fix targets, change the solution overview), request confirmation from the maintainer (or operator in local mode) with a summary of the impact: which subproblems are affected, what work would be invalidated, and the proposed new plan. On confirmation, go back to `planning` to revise. On rejection, proceed with the current plan and note the decision.
   - **New subproblems discovered (LOC-based decomposition):** update the issue plan's subproblem list, pass `/review-plans`.

5. **Update status** {#update-status} — update subproblem tags in the Progress section to reflect their current state. Update the Progress paragraph to describe what was advanced and what remains. When all subproblems are `[landed]` or `[spun-off]`, set the Phase to `closed: resolved` and update the paragraph to reflect that implementation is complete.
