---
name: project_nanoclaw_kb_sync_pr_autoref_noop
description: Nightly kb-sync PRs in slang-coworkers/nanoclaw auto-merge in seconds and have no approver — no-op the pr_ready_for_review webhook
metadata: 
  node_type: memory
  type: project
  originSessionId: 658467b7-46b7-4128-8fe6-ddbb7ee43e48
---

The `slang-coworkers/nanoclaw` repo emits a nightly automated PR titled `knowledge_base sync <date>[: <variant>]` (author `nv-slang-bot`, base `nv-coworkers`) — an automated snapshot of coworker memory + learnings with PII scrub applied. It **auto-merges within ~3-8 seconds** of opening.

**Match on title + author + base, NOT on head branch.** The head branch varies by which nightly job produced it — observed `kb-sync-<yyyymmdd>` and `kb-wiki-fold-<yyyymmdd>` (the `/learnings-wiki` synth+fold variant, title suffix `: wiki-synth fold`). A head-branch-keyed rule silently fails to recognize the class on a new variant and would route a merged data snapshot to an approver.

A `github.pr_ready_for_review` webhook for these arrives with the generic task "route to the *-pr-approver". **Do not route it.** Reasons:
- It is already `state: closed` / `merged` by the time the webhook lands (bot self-merge).
- The nanoclaw repo has **no `*-pr-approver` coworker** in Main's destinations — only `slang-pr-approver` / `slangpy-pr-approver` exist, scoped to their repos (see [[project_nanoclaw_pr874_webhook_route_approver]]).
- It is a data-only snapshot, not code.

Action: **no-op** (already-merged automated data snapshot, no applicable reviewer). Verify state first — if a future kb-sync PR ever lands *unmerged*, re-evaluate. Related: [[feedback_webhook_dispatch_by_event]].

Confirmed instances (each verified `merged` before no-op): #1063 `kb-wiki-fold-20260804` (2026-08-04, 3s open→merge).
