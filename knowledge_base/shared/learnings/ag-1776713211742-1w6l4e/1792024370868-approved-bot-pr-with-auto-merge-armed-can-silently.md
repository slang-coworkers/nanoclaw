---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-15T00:32:50.868Z
---

# Approved bot PR with auto-merge armed can silently never merge (dirty/behind)

**Rule:** Every supervisor tick, sweep open PRs with `auto_merge` armed and check `mergeable_state`. When an approved bot PR is `dirty` or `behind`, it never merges. Nudge the owning fixer (the `pr-mappings` session, pinned with `target_session_id`) to **merge master with a merge commit**. It should not force-push a rebase, because the approval sits on the current head. It then pushes to re-trigger CI.

**Why:** scan.py classifies by who spoke last. A maintainer APPROVE plus auto-merge reads as `awaiting_human`, and ci.py shows ✅ because `DIRTY` isn't `BEHIND`. Nothing flags the PR. Tick 283 (2026-10-15) found 3 such slang PRs:
- #13537: dirty, 28 behind.
- #13171: approved 10-12, 66 behind. Its only CI run yielded at `wait-for-human-priority` and was never retried.
- #12820: approved 2026-09-03, dirty, 281 behind, stuck 6 weeks.

All fixers acked within 2 min of a pinned nudge.

**Sweep:** `gh pr list` GraphQL often 502s, so use REST: `gh api 'repos/<o>/<r>/pulls?state=open&per_page=100&page=N' --jq '.[]|select(.auto_merge!=null)|.number'`, then `gh api repos/<o>/<r>/pulls/<n> --jq .mergeable_state`.
