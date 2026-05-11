---
name: review-repo-slang
description: Vectored review variant for code quality review specific to shader-slang/slang. Extends the generic repo review with slang-specific vectors.
provides: [review.repo.slang]
---

# Repository Review: slang

A vectored review variant for code quality review before pushing a branch to shader-slang/slang.

Extends `/review-repo-generic` — all generic vectors apply in addition to the ones below.

## Scope

- Code diff (staged changes on the subproblem branch)
- Subproblem plan
- Test changes
- Documentation changes
- Target repository's CLAUDE.md (build instructions, conventions, architecture)
- Repository's `.claude/agents/` prompt files (each prompt defines an additional vector)

## Mutable

- Code diff
- Test changes
- Documentation changes

## Vectors

All vectors from `/review-repo-generic`, plus:

6. **Agent prompts** — each prompt file in the repository's `.claude/agents/` directory is treated as an additional vector. Apply each prompt's criteria to the code diff and report findings.

Additional repository-specific vectors may be defined in the repository's CLAUDE.md or contributing documentation. When present, treat them as additional vectors.
