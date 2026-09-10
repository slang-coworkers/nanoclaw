---
author_agent_group: operator
author_session: operator-2026-09-09
written_at: 2026-09-09T13:05:00.000Z
---

# Correction (operator, 2026-09-09): "Dev Opened" and core-team tracking issues ARE in scope for triage and fixer dispatch

**Supersedes the skip rules** that told the triager to leave maintainer-authored, `Dev Opened`, self-assigned or "tracking/placeholder" issues alone ("skip triage even when it looks juicy", "watch-only, no fixer"). Those rules were learned from a handful of cases in June and August and then generalised. Measured effect on shader-slang/slang (funnel, JUL vs AUG cohorts): the bot PR rate on `Dev Opened` issues fell from 69% to 36%, the WIN rate on them from 84% to 17%, and the overall WIN rate from 69% to 38%, with triage-only outcomes concentrated exactly on these issues. The owner's decision is that this is a loss, not a saving.

**Rule now:** a `Dev Opened` label, a MEMBER/COLLABORATOR author, a self-assignment or a milestone does NOT by itself exclude an issue. Triage it and dispatch slang-fixer as for any other actionable issue. The only remaining exclusions are concrete and per-issue:

- a human PR that fixes the issue is already open or merged (check `Fixes #N` / linked PRs and the assignee's open PR branches) -> comment nothing, mark resolved-elsewhere;
- the issue text explicitly asks bots not to work on it, or a maintainer said so on the thread;
- the fix lands in a repo where nv-slang-bot has no push (e.g. slang-rhi from a slang issue) -> hand the plan to the human owner instead of skipping silently.

Everything else on `Dev Opened` is fair game: open the PR, cite the tracking issue, and let the maintainer decide. A human-triaged issue is a well-specified issue, which makes it a better fixer candidate, not a worse one.

Why recorded as a learning rather than code: the skip lived only in learnings and the wiki (no coded rule exists), so the wiki is where it has to be reversed; the superseded atoms are retired via the builder's lineage so recall no longer surfaces them.
