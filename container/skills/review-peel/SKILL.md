---
name: review-peel
description: Vectored review variant that verifies a peeled chunk is self-contained and consistent with the subproblem it was peeled from.
provides: [review.peel]
---

# Peel Review

A vectored review variant that verifies a peeled chunk is self-contained and consistent with the subproblem it was peeled from.

## Scope

- Peeled chunk (code, documentation, tests)
- Peeled subproblem plan
- Parent subproblem plan
- Proof-of-concept PR (remaining diff after peel)
- Target repository's CLAUDE.md (build instructions, conventions, architecture)

## Mutable

- Peeled chunk (code, documentation, tests)
- Peeled subproblem plan

## Vectors

1. **Completeness** — the peeled chunk includes all code, documentation, and tests needed to verify it independently. Nothing required by the chunk is left behind in the proof-of-concept.
2. **Consistency with parent** — the peeled subproblem plan is consistent with the parent subproblem plan. The peeled chunk implements what the peeled subproblem plan describes.
3. **Independence** — the peeled chunk is landable on main/master without the rest of the proof-of-concept being present. The PoC remainder may depend on the peeled chunk (it will receive it via merge from upstream after landing).
4. **Internal alignment** — the peeled subproblem plan is consistent with the peeled code, tests, and documentation.
