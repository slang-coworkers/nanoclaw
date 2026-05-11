---
name: review-plans
description: Vectored review variant for plan consistency during the fix workflow. Verifies issue and subproblem plans against each other, the code, issue feedback, and active PRs.
provides: [review.plans]
---

# Plans Review

A vectored review variant used during the fix workflow to verify plan consistency.

## Scope

- Issue plan
- All subproblem plans
- Transient data and decision rationale in the IKD
- Source code
- Original issue and feedback
- Active PRs (description, feedback, CI results)
- Target repository's CLAUDE.md (build instructions, conventions, architecture)
- GitHub Policy (peel-and-land rules)
- IKD peeling conventions (Progress list structure, tag semantics)

## Mutable

- Issue plan
- Subproblem plans (only those whose PR has not yet been merged)

## Vectors

1. **Internal consistency** — subproblem plans against each other: ordering dependencies, contradictions, overlapping changes.
2. **Code validity** — subproblem plans against the code: accuracy of claims about the codebase.
3. **Issue alignment** — issue plan and subproblem plans against the original issue and any feedback added to it.
4. **PR alignment** — issue plan and subproblem plans against active PRs: description, feedback, CI results for still-open subproblems.
5. **Peel consistency** — when subproblems are in `[peeling]` state: peeled chunk entries are correctly positioned and annotated in the Progress list, parent subproblem plan has not been modified based on in-flight peeled chunks, peeled chunk plans are consistent with the parent's decomposition, and proof-of-concept PR reflects the full outstanding change.
