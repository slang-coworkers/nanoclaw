---
type: project
title: "Root cause of issue"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Root cause of issue

**Root cause of session-reuse / PR mis-attribution** (found 2026-06-03 investigating why slang #11410 had two near-identical draft PRs, #11422 + #11435):

A coworker (fixer) session is sometimes reused across issues. The supervise-issues nudge instruction said "use `in_reply_to` of the LAST inbound the coworker received." When that session's last inbound belonged to a *different* issue's thread, routing **Layer 1 (`in_reply_to`) overrides `thread_id`** (`src/modules/agent-to-agent/agent-route.ts` — explicitTarget beats fresh-delegation), so the #11410 nudge landed in the fixer's reused #11375 session. The fixer then did #11410's work there and `report_pr_created` stamped PR #11435 with `threadId=gh-issue-…-11375` → mis-attributed duplicate of the correctly-threaded #11422.

**The host routing was correct** — `resolveSession` per-thread keys on `(agentGroup, a2a-mg, thread_id)` and isolates per issue. The base spine already had the rule: `container/spines/base/tool-instructions/agents.md:16` — "fresh delegation must carry explicit `thread_id`; without it the runtime reuses the most recent inbound thread from that peer, piling every dispatch into one session." Only the **supervise-issues skill** violated it.

**Fix (PR on nv-slang):** supervise-issues SKILL.md — nudges MUST route by `thread_id="gh-issue-<repo>-<num>"`, never `in_reply_to`; plus the thread≠work-product `[MUST]` and the `pr_session_mappings`-based PR resolution in step 1 (so the supervisor files PRs under the issue the body actually `Fixes #N`, not the thread number). Resolved #11435 closed as dup; #11422 is the keeper.

This is the same thread≠issue class as [[project_container_pr_lookup]] (use pr_session_mappings + closedByPullRequestsReferences, not thread_id). Relates to [[project_pr_session_mapping]] and [[project_backfill_thread_rejoin]].

