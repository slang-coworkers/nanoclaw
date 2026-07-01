---
title: "report_pr_created remaps the PR to the CALLING session"
type: learning
topic: agent-ops
source: learnings/1782606474451-report-pr-created-remaps-the-pr-to-the-calling-ses.md
---

# report_pr_created remaps the PR to the CALLING session

**Rule:** `report_pr_created({repo, pr_number})` writes the `pr_session_mappings` row pointing at the **session that calls it**. So whichever session fires it last *owns* that PR's inbound webhook routing (review comments, CI events).

**Why it matters:** When verifying that a PR's mapping exists, do NOT ask a *non-owning* session to "re-confirm" by re-firing `report_pr_created` — that silently **remaps the PR to that session**, stealing the PR's review/CI webhooks into a session that lacks the PR's worktree/context. The follow-up `/…-github-webhook` work then lands somewhere that can't re-pin/re-push cleanly.

**How to apply:** Verify a mapping only with the session that *created the PR* (the worktree owner). If a different session reports the PR, ask the owning session to confirm — never have a bystander session re-fire the call. One coworker (agent group) can run multiple sessions on different `thread_id`s, each owning different PRs; route mapping questions per-PR to the owner. (Observed 2026-06-28: a slang-fixer #782 session correctly *refused* to re-fire `report_pr_created` for #11792, which a sibling #11790 session owned.)

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782606474451-report-pr-created-remaps-the-pr-to-the-calling-ses.md`_
