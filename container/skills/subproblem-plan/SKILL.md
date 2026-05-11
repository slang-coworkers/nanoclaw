---
name: subproblem-plan
description: "Subproblem state: plan. Research, evaluate alternatives, and create the subproblem plan."
provides: [fix.subproblem.plan]
---

# Subproblem — Plan

Research the target repository and refine the subproblem plan created during issue planning.

## Invariants

- If this subproblem was peeled from another subproblem, do not modify the parent subproblem's plan or implementation. The parent's proof-of-concept PR remains the source of truth until this chunk lands (see GitHub Policy, peel-and-land).

## Steps

1. **Set up environment** {#setup-env} — load the target repository's CLAUDE.md. If a branch already exists for this subproblem in the target repository, check it out; otherwise check out main/master. For dependency repositories: check out main/master if the dependency has landed, or the dependency's branch if not (if the dependency is undergoing peel-and-land, use the proof-of-concept branch).

2. **Research** {#research} — investigate the target repository's code relevant to this subproblem. Understand the existing implementation, related code paths, and constraints. Identify relevant existing tests that exercise the affected code. Add relevant findings to the IKD.

3. **Draft plan with alternatives** {#draft} — fill in the subproblem plan template: definition, root cause analysis (scoped to the subproblem), reproduction info (proxy or direct), proposed change, alternatives considered. Identify at least one alternative approach that achieves the same result consistent with the issue plan's decomposition.

4. **Evaluate alternatives** {#evaluate} — evaluate the proposed change and alternatives against the target repository's conventions, architecture, and patterns (from CLAUDE.md and code read during research). Select the best approach and document why it was chosen over the alternatives.

5. **Verify alignment** {#verify-alignment} — confirm the plan is still aligned with the issue plan's decomposition and solution overview. If the research or alternative evaluation changed the approach, update the issue plan accordingly.

6. **Define branch** {#branch} — set the branch name: `coworker/fix-<issue#>-<descriptor>`.

7. **Define test plan** {#test-plan} — if the subproblem causes a detectable behavioral change, the test plan must include a repro regression test. Document risks/blast radius.

8. **Note dependencies** {#check-deps} — if the subproblem depends on another subproblem or external issue, record the dependency in the plan. Implementation is blocked until the dependency has an implementation (even if only a local branch — it does not need to be landed). Transition to review is blocked until the dependency has landed on main/master.

9. **Update status** {#update-status} — set the subproblem plan's `Status:` to `implementing`. Update the subproblem's tag in the issue plan's Progress list to `[implementing]`.
