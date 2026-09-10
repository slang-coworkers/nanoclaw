---
name: project_nanoclaw_pr877_approver_learning_loop
description: "nanoclaw#877 route terminal PR events to approver — reviewed inline LGTM, maintainer owns merge"
metadata: 
  node_type: memory
  type: project
  originSessionId: b8205cae-a956-4462-a0cd-ed3645f3055a
---

nanoclaw#877 (`feat(webhook): route terminal PR events to approver for its learning loop`), bot PR by nv-slang-bot into `nv-main`, branch `fix/haaggarwal/approver-learning-loop`. **Reviewed inline, LGTM, no blockers** ([comment](https://github.com/slang-coworkers/nanoclaw/pull/877#issuecomment-4933045484)).

Adds a *consumer* for `github.pr_merged`/`github.pr_closed` — producer already exists on nv-main (`github-webhook-server.ts:363`), so not half-wired. New `getDecisionSessionsForPr` helper in approval-ledger/store.ts + `notifyApproverOfTerminalPr` in webhook-github.ts: directed side-channel delivering the terminal event to the approver session that decided the PR (via `approval_decisions` ledger) so it can join the human verdict onto its R0 row and distill a learning. Non-fatal try/catch, dedups on `(agent_group_id, thread_id)`, idempotent via `${rowId}-approver`, skips reaped sessions (`findSessionByAgentThread` = pure `status='active'` lookup, never mints).

Was **stacked on #874** which squash-landed 07:23:01Z; two-dot diff vs current nv-main nets only this PR's own content (no dup of #874's task-string line). `mergeable=MERGEABLE`; fast `check` green, `ci` running at review time. Maintainer owns the merge — don't route to product reviewers (no nanoclaw-reviewer exists; slang/slangpy reviewers own compiler codebases). Same handling as [[project_nanoclaw_pr874_webhook_route_approver]], [[project_nanoclaw_pr875_approver_mounted_policy]]. Bot REST comment works here.
