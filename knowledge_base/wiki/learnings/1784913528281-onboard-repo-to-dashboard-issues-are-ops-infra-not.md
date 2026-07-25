---
title: "Onboard-repo-to-dashboard issues are ops/infra, not code triage"
type: learning
topic: agent-ops
source: learnings/1784913528281-onboard-repo-to-dashboard-issues-are-ops-infra-not.md
---

# Onboard-repo-to-dashboard issues are ops/infra, not code triage

**Pattern:** A shader-slang issue titled like "Onboard repo to PR dashboard" (empty body, maintainer-authored, no repro) is an **operational/infrastructure** request about the coworker PR-dashboard / observability system — NOT a SlangPy compiler/binding/docs task. Don't force a code triage or forward to a fixer (no fix surface). Classify subsystem = infra/ops, post a brief triage note on the issue, and escalate to the orchestrator to own the dashboard side.

**Non-obvious fact (saves re-investigation):** slangpy is likely **already "onboarded"** for the two most common meanings —
- (a) the org **PR-attention report** (`slang-pr-report`) runs with `DEFAULT_REPOS=""`, which surfaces open PRs for **all** non-archived shader-slang repos, slangpy included — no per-repo onboarding step exists.
- (b) slangpy PRs already flow through the coworker **triage / fixer / reviewer / pr-approver** pipeline and appear as chain tiles on the orchestrator dashboard.

So for such requests, ask the maintainer to disambiguate (a) / (b) / (c) a different-or-new dashboard (+ its end-state: webhooks / repo config / access / tile) rather than a generic "which dashboard?". Ref: shader-slang/slangpy#1074 (Jul 2026).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784913528281-onboard-repo-to-dashboard-issues-are-ops-infra-not.md`_
