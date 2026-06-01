# Maintainer Gotchas

Cross-cutting pitfalls for every `/slang-maintain` task. Read before your first sweep.

## Rate limits

- **GitHub REST**: 5000 req/hr. Fetch once per repo and filter client-side, not one request per label/author.
- **GitHub GraphQL**: 5000 points/hr (separate from REST). `list_issues` uses GraphQL.
- **Slack**: tier-dependent; call `slack_get_user_profile` sequentially.
- **Discord**: 50 req/s per bot; chained `read_messages` pagination can trip the global limit.

## Pagination

- **`github_list_issues`** — loop `after=<endCursor>` until `hasNextPage` false. Cap 100.
- **`discord_read_messages`** — max 100/call; paginate backwards (`before=<last_message_id>`).
- **`slack_get_channel_history`** — tier 3; limit=100/call; pass `since` to bound the window.

## Identity resolution

- Resolve Slack user IDs (`U01ABC…`) via `slack_get_user_profile` sequentially.
- Correlate GitHub login ↔ Slack ↔ Discord only when both sides are in the input; never invent mappings. Prefer full names over handles.

## Data quirks

- **Squash-merged PRs** lose per-commit messages — use the PR description for release notes.
- **Draft PRs** excluded from release-notes and daily-report; confirm `pr.draft == false` if MCP hasn't filtered.
- **PRs without labels** — categorize via title-prefix heuristics; escalate to the user only if ambiguous AND significant (e.g. potential breaking change).
- **Issues with no `priority` field** fall through the ProjectV2 extractor — treat as `P3`/unknown.

## Configuration

- **Channel IDs** (Discord/Slack) are per-group via `CLAUDE.md`/`.env`, not hardcoded; inline IDs in a recipe are stale.
- **GitLab project ID** is installation-specific (e.g. `6417`) — parameterize.
- **Default owner/repo** is `shader-slang/slang`; override in `Args` for `slang-rhi` or `slangpy`.

## Output hygiene

- Unicode emoji (🚨 ⚠️ ✅), not shortcodes (don't render in terminal/markdown).
- Always timestamp reports (`YYYY-MM-DD` or ISO 8601).
- Cite direct URLs; link "PR 1234", don't just name it.
- Note any failed source (MCP error, rate-limit) under "Data Collection Notes" — silent partial reports mislead.

## When to escalate to `/plan` or `/slang-implement`

- Bug/regression → `/plan` to diagnose, then `/slang-implement` to fix.
- Stale PR / abandoned MR → escalate to the user; don't auto-close.
- Git ops (SPIRV submodule update, GitLab rebase) are WRITE ops, out of scope for `/slang-maintain` — raise a task for a writer coworker.
