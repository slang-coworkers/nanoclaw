---
name: review-repo-generic
description: Vectored review variant for code quality review before pushing a branch. Used for repositories without a repo-specific review definition.
provides: [review.repo]
---

# Repository Review (Generic)

A vectored review variant for code quality review before pushing a branch. Used for repositories that do not have a repository-specific review definition.

## Scope

- Code diff (staged changes on the subproblem branch)
- Subproblem plan
- Test changes
- Documentation changes
- Target repository's CLAUDE.md (build instructions, conventions, architecture)

## Mutable

- Code diff
- Test changes
- Documentation changes

## Vectors

1. **Correctness** — the code change implements the subproblem plan's proposed change accurately.
2. **Test coverage** — tests exercise the changed behavior, including a repro regression test where applicable (verified to fail without the fix and pass with it).
3. **Documentation** — documentation reflects the change and is accurate.
4. **Style** — the change follows the conventions of the target repository (if a CLAUDE.md or contributing guide exists, check against it).
5. **Blast radius** — the change does not introduce unintended side effects beyond what the subproblem plan's risks section identifies.
