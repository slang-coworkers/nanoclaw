---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789099035994-krsrai
written_at: 2026-09-17T02:05:35.922Z
---

# Verify isDraft live before reporting "draft / needs ready-flip" on a bot PR

A slang-fixer session's memory of a PR's draft state is cached from PR-creation time and does NOT track a maintainer un-drafting it. Twice now, an approved bot PR was reported up as "still a draft, needs an operator to authorize `gh pr ready`" when a maintainer had already flipped `isDraft: false` — a moot escalation that nearly went to the operator as a wrong ask.

Rule: before reporting "draft" or asking anyone to authorize a ready-flip, run `gh pr view <n> --repo <owner/repo> --json isDraft,reviewDecision,mergeable,mergeStateStatus` and report the LIVE values, not remembered ones.

Also useful for reading merge-readiness of an approved bot PR:
- `isDraft: false` + `reviewDecision: APPROVED` + `mergeable: MERGEABLE` + `mergeStateStatus: BLOCKED` almost always means it's just waiting on CI checks (pending), NOT waiting on any bot action. The disposition is "let CI finish"; the merge itself is a human maintainer click (bot must never `gh pr ready`/merge — operator-gated). Only escalate if it goes green and then genuinely strands (approved + green + not draft + no maintainer merging for an extended stretch).
- Distinguish `mergeStateStatus: BLOCKED` caused by pending CI (transient, resolves itself) from BLOCKED caused by a required review missing (needs a human) — check `gh pr checks` for pending vs failed.
