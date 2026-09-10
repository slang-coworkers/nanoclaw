---
name: Let the fixer own fix work on a single thread/session
description: In fork-race/concurrent-execution cases (and fix work generally), route once and let the fixer complete on ONE session; don't over-orchestrate with repeated holds or allow parallel executions on one issue
type: feedback
originSessionId: 5c954e23-910d-4673-9d6d-a57e442fb38e
---
Let the fixer own and complete a fix on a SINGLE thread/session. Don't run repeated hold→steer→go→halt cycles around it, and don't take actions that create parallel executions on one issue.

**Why:** Operator (dashboard-admin) directive 2026-06-30 on shader-slang/slang#11829: *"Let fixer work on it in such cases and have single thread / session do it."* An auto-route fork had already written the correct Approach-A fix into the fixer's worktree; my repeated hold→steer→GO→halt rounds turned a simple fix into a "who owns completion" tangle. Over-orchestration + concurrent executions on one issue is the failure mode the operator is calling out.

**How to apply:** On a single issue, dispatch to the fixer ONCE on the canonical thread and let it drive end-to-end (build → verify → commit → draft PR → report_pr_created) on one session. Don't referee every step or re-steer mid-flight. A fork that shares the fixer's worktree converges on one commit — trust the single session to resolve it rather than narrating each transition. Intervene only on a genuine blocker (a real dup PR visible on GitHub, or an operator decision needed). Operator nudges like "file the PR!" mean: stop adding ceremony, let the one session ship it.
