# Release Notes Generation

Generate release notes from merged PRs between two tags/commits.

## Workflow

1. Identify the range: previous release tag → current HEAD (or specified tag).
2. Fetch merged PRs in range via `mcp__slang-mcp__github_list_pull_requests`.
3. Categorize by label/title prefix: **Features** (new language features/backends), **Bug Fixes** (fix/regression), **Performance** (optimization/perf), **Infrastructure** (CI/build/testing), **Documentation** (docs/examples).
4. Get review comments for context where needed.
5. Generate formatted notes.

## Output Format

```markdown
# Slang {version} Release Notes

## Highlights

- {1-3 sentence summary}

## Features

- {PR title} (#{number}) — @{author}

## Bug Fixes

- ...

## Performance

- ...

## Infrastructure

- ...

## Contributors

{unique PR authors}
```

## Gotchas

- PRs without labels — categorize via title-prefix heuristics; escalate to the user only if ambiguous AND significant (e.g. potential breaking change).
- Squash-merged PRs lose per-commit messages — use the PR description.
- Exclude draft PRs.
