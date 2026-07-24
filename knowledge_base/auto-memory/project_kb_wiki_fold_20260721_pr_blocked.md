---
name: kb-wiki-fold-20260721-pr-blocked
description: 2026-07-21 kb wiki-synth fold was PR-blocked by REST 401; SUPERSEDED — 07-22 sync (PR #1002) landed both days' folds
metadata: 
  node_type: memory
  type: project
  originSessionId: 4ea131b6-4a51-4230-b05f-9d5705dad6a1
---

# 2026-07-21 knowledge_base wiki-synth fold — was PR-blocked, now SUPERSEDED by 07-22

**RESOLVED 2026-07-22.** The 07-21 fold (coverage 1555/1555, 19 uncovered → 11 concept pages) pushed as branch `kb-wiki-fold-20260721` but its PR-open+merge 401'd on the slang-coworkers gateway REST cred (auth-split: git-push + shader-slang App-token path both worked; only `gh api repos/slang-coworkers/*` REST was dead). Left as a clean FF branch on origin, no PR.

**Why no manual resume was needed:** the 07-21 concept-page edits persisted in `/workspace/shared/wiki` (shared wiki is durable). The 07-22 daily sync rebuilt from that full shared wiki off current `origin/nv-coworkers`, so PR #1002 (merged `776d7b7e`, base nv-coworkers) carried BOTH days' folds — the 07-22 diff showed 27 concept pages modified (16 from 07-22 + the 11 from 07-21). Coverage 1594/1594. Gateway REST cred was healthy on 07-22 (PR opened+merged cleanly on first try). The blocked `kb-wiki-fold-20260721` branch is now stale/orphaned on origin (safe to ignore or delete; nothing owed).

**Lesson:** a KB-sync PR blocked purely at the publish step (branch pushed, content in `/workspace/shared`) self-heals on the next daily fire — the next run rebuilds from the durable shared wiki off the live base and lands everything. No manual resume of the old branch is needed once the gateway cred recovers. Same auth-split class as [[project_github_actions_graphql_401_outage]].

**#1003 (2026-07-22)** — `knowledge_base sync 2026-07-22 (cred-fix revalidation)`, branch `kb-sync-revalidate-20260722` → `nv-coworkers`, bot-authored (`nv-slang-bot`). `pr_ready_for_review` webhook (reason `opened`) carried the generic post-#874 "route to the project's *-pr-approver coworker (never a reviewer/fixer)" task string — **standing rule overrides** ([[project_nanoclaw_pr874_webhook_route_approver]]): NanoClaw-platform fork, no nanoclaw approver wired; routing a nanoclaw-repo kb-sync PR to a slang/slangpy COMPILER approver is nonsensical. **Already MERGED by review time, EMPTY diff** (`changedFiles: 0`, `+0/-0`) — a no-content cred-fix revalidation confirming the slang-coworkers gateway REST cred is healthy again (the auth condition that blocked the 07-21 fold above). `label`✓ pass. Self-merged within [[feedback_nv_coworkers_automerge]] (`nv-coworkers` base, kb-sync class). **Pure no-op** — NOT routed to product `*-pr-approver`, NOT reviewed, NOT commented (empty already-merged revalidation; comment hygiene). Nothing owed.

**#1008 (2026-07-23)** — `knowledge_base sync 2026-07-23`, branch `kb-sync-20260723` → `nv-coworkers`, bot-authored (`nv-slang-bot`), the **normal daily KB wiki-synth fold** (158 files, +5152/-958 — full-content sync, unlike #1003's empty revalidation). `pr_ready_for_review` webhook (reason `opened`) carried the generic post-#874 "route to the project's *-pr-approver coworker (never a reviewer/fixer)" task string — **standing rule overrides** ([[project_nanoclaw_pr874_webhook_route_approver]]): NanoClaw-platform fork, no nanoclaw approver wired; routing a nanoclaw-repo kb-sync PR to a slang/slangpy COMPILER approver is nonsensical. **Already MERGED by review time** (`state: MERGED`; `label`✓ pass, run 29975980871). Self-merged within [[feedback_nv_coworkers_automerge]] (`nv-coworkers` base, kb-sync class). **Diff CONTENT not read** — daily automated wiki-synth fold, classification unambiguous from webhook payload + branch + author; no content verdict claimed (no receipts per [[feedback_never_relay_a_verdict_not_in_hand]]). **Pure no-op** — NOT routed to product `*-pr-approver`, NOT reviewed-for-routing, NOT commented (already-merged self-evident bot sync; comment hygiene). Nothing owed.
