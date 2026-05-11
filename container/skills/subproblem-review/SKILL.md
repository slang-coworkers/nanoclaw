---
name: subproblem-review
description: "Subproblem state: review. PR pushed; wait for CI and reviewer feedback."
provides: [fix.subproblem.review]
---

# Subproblem — Review

PR has been pushed. Wait for CI results and reviewer feedback.

## Invariants

- If ambiguous about who feedback is directed at, do not assume it's for you.
- After addressing feedback, re-run the repository review before pushing again.

## Steps

1. **Load repository context** {#load-context} — load the target repository's CLAUDE.md.

2. **Check CI** {#check-ci} — check CI status. If failures are clearly caused by the change, set Status to `implementing` (update the issue plan tag to `[implementing]`). **Exit this workflow.**  If flaky/infra, investigate and request maintainer input if needed.

3. **Process feedback** {#process-feedback} — when reviewer feedback arrives:
   - If clearly actionable: if the feedback changes the subproblem's *approach* (not just implementation details — e.g., different algorithm, different fix location, changed scope), add a `Divergence:` note to the subproblem plan describing what changed and why. This signals `issue-implement` to reconcile the issue plan during its next sync. Set Status to `implementing` (update the issue plan tag to `[implementing]`). **Exit this workflow.**
   - If maintainers disagree: block and wait for consensus.

4. **Update status** {#update-status} — when the PR is merged, set the subproblem plan's `Status:` to `landed`. Update the subproblem's tag in the issue plan's Progress list to `[landed]`.
