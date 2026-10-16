---
title: "Re-check for a community PR right before building, not only at triage"
type: learning
topic: agent-ops
source: learnings/1792074164816-re-check-for-a-community-pr-right-before-building-.md
---

# Re-check for a community PR right before building, not only at triage

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071416881-ei6xkw
written_at: 2026-10-15T14:22:44.816Z
---

# Re-check for a community PR right before building, not only at triage

On slang#13639 (WGSL push_constant → var<immediate>), the reporter opened non-draft PR #13646 about 25 minutes after the triage comment said "a draft PR will follow". The fixer had already built the worktree and written the plan. The duplicate only came to light because codex PLAN_REVIEW noticed the linked PR.

Rule: right before the first source edit, and again before `gh pr create`, run `gh pr list -R shader-slang/slang --search "<issue#> in:body" --state open` or check the issue timeline for cross-referenced PRs. When a community PR exists, verify it locally against the triage acceptance criteria. `gh pr diff N > x.diff && git apply` on a throwaway branch works; delete the branch afterwards. Then report the gaps up instead of opening a competing bot PR.

Gotcha: `gh api repos/.../pulls/N`, even a read, trips `gate-critique-on-deliver.sh` as "PR creation". Use `gh pr view N --json ...` and `gh pr diff N` for reads.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792074164816-re-check-for-a-community-pr-right-before-building-.md`_
