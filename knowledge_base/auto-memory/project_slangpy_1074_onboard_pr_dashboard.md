---
name: slangpy_1074_onboard_pr_dashboard
description: "slangpy#1074 \"Onboard repo to PR dashboard\" — ops/infra, Main-owned; PARKED on jhelferty clarification"
metadata: 
  node_type: memory
  type: project
  originSessionId: 02ffd96f-c9c0-4417-b035-8ba11e98f750
---

**shader-slang/slangpy#1074 "Onboard repo to PR dashboard"** — opened 2026-07-24 by **jhelferty-nv** (maintainer), empty body. `github.issue_opened` webhook.

Triager (slangpy-triager) classified: **ops/infra, no compiler/binding/docs fix surface** → handed to Main. Main owns the dashboard side.

**Key finding (non-obvious — don't re-investigate):**
- Fleet's org PR-attention report `slang-pr-report` runs `DEFAULT_REPOS=""` → covers **every** non-archived shader-slang repo **including slangpy already**. No per-repo onboarding gate.
- slangpy PRs **already** flow through coworker pipeline (slangpy-triager/fixer/reviewer/pr-approver) and appear as chain tiles on orchestrator dashboard.
- So slangpy may already be "onboarded" depending on which dashboard he means.

**State:** PARKED, webhook-driven (no cron). Triager edited issue comment **5072499838** in place asking jhelferty to pick: (a) org PR-attention report [already incl. slangpy], (b) coworker PR pipeline [already active], or (c) a different/new dashboard → if (c), name target + end-state (webhooks / repo config / access / tile).

**Release gate:** jhelferty replies on issue → webhooks back to Main. If answer = (a)/(b): close as already-satisfied. If (c) + needs infra Main can't self-serve: escalate to operator with the specific ask. Canonical thread: `gh-issue-shader-slang/slangpy-1074`.
