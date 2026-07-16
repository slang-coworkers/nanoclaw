---
name: project_nanoclaw_kb_sync_pr_autoref_noop
description: Nightly kb-sync PRs in slang-coworkers/nanoclaw auto-merge in seconds and have no approver — no-op the pr_ready_for_review webhook
metadata: 
  node_type: memory
  type: project
  originSessionId: 658467b7-46b7-4128-8fe6-ddbb7ee43e48
---

The `slang-coworkers/nanoclaw` repo emits a nightly automated PR titled `knowledge_base sync <date>` (author `nv-slang-bot`, head `kb-sync-<yyyymmdd>`, base `nv-coworkers`) — an automated snapshot of coworker memory + learnings with PII scrub applied. It **auto-merges within ~8 seconds** of opening.

A `github.pr_ready_for_review` webhook for these arrives with the generic task "route to the *-pr-approver". **Do not route it.** Reasons:
- It is already `state: closed` / `merged` by the time the webhook lands (bot self-merge).
- The nanoclaw repo has **no `*-pr-approver` coworker** in Main's destinations — only `slang-pr-approver` / `slangpy-pr-approver` exist, scoped to their repos (see [[project_nanoclaw_pr874_webhook_route_approver]]).
- It is a data-only snapshot, not code.

Action: **no-op** (already-merged automated data snapshot, no applicable reviewer). Verify state first — if a future kb-sync PR ever lands *unmerged*, re-evaluate. Related: [[feedback_webhook_dispatch_by_event]].
