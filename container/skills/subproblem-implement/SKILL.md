---
name: subproblem-implement
description: "Subproblem state: implement. Write or update code on the subproblem branch."
provides: [fix.subproblem.implement]
---

# Subproblem — Implement

Write or update code on the subproblem branch.

## Invariants

- Each subproblem fixing an issue or causing a detectable behavioral change needs a repro regression test, verified both with and without the fix.
- Count source code, documentation, and testing line changes separately — only source code counts toward size thresholds.

## Steps

0. **Check for peeling re-entry** {#peel-reentry} — if Status is `peeling` and a peeled chunk has landed, merge upstream into this branch so `gh pr diff` shows just the remaining changes. Skip to step 9 (check size).

1. **Set up environment** {#setup-env} — load the target repository's CLAUDE.md. Check out the subproblem branch (create it from main/master if it doesn't exist yet). If this subproblem depends on another subproblem, configure the build to use the dependency's branch (e.g., check out the dependency branch in the submodule, or build with the local dependency using Git Policy conventions). This allows verifying the full fix end-to-end before any subproblem enters review.

2. **Review prior work** {#review-prior} — on first entry, review the PRs that contributed to the code being modified, and comments on those PRs and their linked issues, to understand intent. Add relevant findings to the IKD. On re-entry, review the feedback or CI failure that triggered the return to `implementing`.

3. **Write repro test** {#repro-test} — on first entry, write the repro regression test that reproduces the problem statement and verify it fails on main/master (confirming the problem exists). On re-entry, verify the existing repro test still covers the problem statement — update it if feedback changed the scope.

4. **Implement changes** {#implement} — write or update code on the subproblem branch. On re-entry, address the specific CI failure or review feedback that caused the return.

5. **Verify repro test passes** {#verify-repro} — confirm the repro test now passes with the fix applied.

6. **Write additional tests** {#additional-tests} — write any additional tests needed beyond the repro test (edge cases, related code paths, coverage gaps identified during planning or requested in review feedback). Verify all new tests pass.

7. **Run repository review** {#repo-review} — run the target repository's repository review (`/review-repo-generic` or repo-specific variant). Address all findings before pushing.

8. **Push and open PR** {#push-pr} — push the branch. If no PR exists, create one with description per GitHub Policy ("Part of" / "Fixes" and dependency references), create the PR status comment, and update the issue status comment to reflect the new PR. If a PR already exists, update its description if the plan changed and push the new commits.

9. **Check size** {#check-size} — count source lines changed. If >50, consider whether an independent concept can be extracted and landed separately. If >100 (overridable by a human), peel-and-land is required unless the subproblem can be broken into independent subproblems landable as separate PRs.

10. **Peel if needed** {#peel} — if peel-and-land is triggered, see [Peel-and-land](#peel-and-land). Update Status to `peeling, blocked: waiting for <chunk> PR`. **Exit this workflow.**

11. **Check dependency readiness** {#check-deps} — if this subproblem depends on another subproblem, the dependency must have landed on main/master before this subproblem can transition to review. If not yet landed, keep Status at `implementing` and mark the PR "do not submit" to verify CI, but do not request review. **Exit this workflow.**

12. **Update status** {#update-status} — set the subproblem plan's `Status:` to `in-review`. Update the subproblem's tag in the issue plan's Progress list to `[in-review]`.

## Peel-and-land

Peel-and-land is an asynchronous process. The parent subproblem and each peeled chunk are independently dispatchable subproblems that can receive feedback, CI results, and maintainer direction independently.

### Peeling a chunk

1. Identify code, tests, and documentation that can be landed independently and fall under the source LOC limit.
2. Create a separate branch with just those changes.
3. Create a new subproblem entry in the issue plan's Progress list (above the parent, tagged `[planned]`, noting "Peeled from PR repo#N").
4. The peeled chunk goes through the full subproblem lifecycle (`/subproblem-fix`: plan → implement → review → close).
5. Before pushing the peeled chunk's PR: must pass `/review-peel` and the target repository's repository review.
6. Update the parent subproblem's Status to `peeling, blocked: waiting for <chunk> PR`.

### When a peeled chunk lands

1. The parent subproblem unblocks.
2. Merge upstream into the parent's branch so `gh pr diff` shows just the remaining changes.
3. Re-evaluate the remaining size. If still >100 source lines, peel again (repeat from above). If <=100, the parent can transition to `[in-review]` and land directly.

### Constraints

- Each peeled chunk must build and run cleanly independently with the full test suite on all platforms (the target repository's CI matrix).
- Related documentation and test coverage must be peeled alongside the code they cover.
- If unable to find a clean peel: block and request maintainer guidance on the PR.
- Track the current decomposition in the original issue.
- Changes to the peeled chunk do not impact the parent until the chunk lands — the parent's proof-of-concept PR retains the full outstanding change.
- Feedback on the peeled chunk (reviewer requests to include more or less) is handled within the peeled chunk's own subproblem lifecycle.

### Proof-of-concept PR

The parent subproblem's PR containing the full outstanding change. Marked "do not submit" until it is small enough to land directly.

- As peeled chunks merge, the proof-of-concept shrinks — it is not abandoned.
- Must pass CI on all platforms. Check regularly.
- When <=100 source lines remain, land directly as the final PR.

## Spin-off

If a subproblem is no longer necessary for the current issue but is still relevant to the project, it can be spun off as a separate issue. This requires maintainer approval; in local mode, the operator may approve. Provide a <20 line summary as a comment on the original issue.
