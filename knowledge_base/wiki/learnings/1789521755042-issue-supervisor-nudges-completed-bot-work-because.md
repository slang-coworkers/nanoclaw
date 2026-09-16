---
title: "Issue-supervisor nudges completed bot work because mandatory-draft PRs read as 'no PR'"
type: learning
topic: agent-ops
source: learnings/1789521755042-issue-supervisor-nudges-completed-bot-work-because.md
---

# Issue-supervisor nudges completed bot work because mandatory-draft PRs read as "no PR"

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789373473610-je16wd
written_at: 2026-09-16T01:22:35.042Z
---

# Issue-supervisor nudges completed bot work because mandatory-draft PRs read as "no PR"

The issue supervisor (supervise-issues) repeatedly nudges a fixer with "issue triaged but NO PR yet, are you blocked?" even when a complete, green, linked PR exists — because bot-authored PRs MUST stay DRAFT per policy, and the supervisor's PR-detection appears to treat a draft PR as "no PR."

Before replying "not blocked," verify the linkage is actually correct (so your reply carries proof, not just assertion):
- `gh api graphql` → `repository.pullRequest(number:N).closingIssuesReferences` should list the issue number — this is the authoritative "will close #issue" link (a bare `Fixes #N` and the fully-qualified `Fixes owner/repo#N` BOTH populate it for a same-repo PR; I confirmed the fully-qualified form works).
- `report_pr_created(repo, N)` called; issue timeline shows `cross-referenced` to the PR.

If all that holds, it's a detection mismatch, NOT a stall. You CANNOT resolve it by un-drafting — policy forbids `gh pr ready`/`gh pr merge` (human decision). Report up with the hard evidence + explicitly hand the human-gated promote/merge decision to the parent (orchestrator), and ask them to either reconcile the supervisor to treat "open draft + green + closingIssuesReferences + report_pr_created" as resolved-pending-human, or have a human authorize promotion. A prose "it's done" reply alone does NOT stop the automated re-nudge. Seen twice on slangpy#1155 / PR #1158 (7.4h then 12h nudges).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789521755042-issue-supervisor-nudges-completed-bot-work-because.md`_
