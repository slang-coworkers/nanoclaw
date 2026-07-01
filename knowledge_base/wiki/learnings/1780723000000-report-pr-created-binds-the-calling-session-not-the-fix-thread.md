---
title: "report_pr_created binds the CALLING session — open the PR from the fix thread, not a chat"
type: learning
topic: agent-ops
source: learnings/1780723000000-report-pr-created-binds-the-calling-session-not-the-fix-thread.md
---

# report_pr_created binds the CALLING session — open the PR from the fix thread, not a chat

**Date:** 2026-06-06
**Source:** #11492 mis-mapping incident

## What happens

`report_pr_created(repo, pr)` writes a `map_pr_session` action; the host handler (`src/modules/pr-mapping/index.ts`) binds the mapping to **`session.id` + `session.thread_id` of whatever session called it** — not the issue/PR thread. Whatever session you're in when you call it becomes the PR's webhook owner.

## The failure mode (observed on PR #11492 / slang#11487)

The #11487 fix ran in the issue-thread session (`gh-issue-shader-slang/slang-11487`), but — because of the stale "no fork → patch fallback" wording — it ended in **patch mode and never opened a PR**. The PR was created **later, from a separate dashboard-chat session** (thread_id NULL), which is where `report_pr_created` got called. Result:

- PR #11492 mapped to the **chat session** (null thread), not the fix session.
- All #11492 webhooks (CI failure, CodeRabbit reviews) routed to the chat session — divorced from the fix worktree context and the canonical gh-issue thread, so GitHub replies wouldn't thread and the chat session (correctly) just *held for operator approval* instead of driving the fix.
- The delivery "succeeded" (no drop) — so logs look fine. The bug is silent: right group, wrong session, null thread.

## How to avoid

- **Open the PR from inside the fix chain's session** (the one on `gh-issue-<owner>/<repo>-<n>`), and call `report_pr_created` there — so the mapping binds the right session + thread. Pushing `fix/issue-<n>` direct to origin (no patch detour) keeps PR-creation in that session. See [[1780685454567-slang-fixer-can-push-fix-branches-direct-to-origin]].
- If a PR is already mis-mapped: `UPDATE pr_session_mappings SET session_id=<fix-session>, thread_id='gh-issue-<owner>/<repo>-<n>' WHERE repo=? AND pr_number=?`. The webhook server reads the mapping live per-event (`deliverMappedPrEvent` → `getDb().prepare(...).get`), so no restart is needed; re-dispatch any already-delivered webhook to the corrected session.
- Symptom to watch: `github-webhook: delivered via PR mapping ... threadId=null` — a null thread on a gh-issue-derived PR means it was bound from a non-issue session. Related: [[1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker]] (same #11487/#11492 cleanup cluster).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780723000000-report-pr-created-binds-the-calling-session-not-the-fix-thread.md`_
