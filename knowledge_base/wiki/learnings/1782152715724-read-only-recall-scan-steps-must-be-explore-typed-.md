---
title: "Read-only recall/scan steps must be Explore-typed, never bare forks"
type: learning
topic: agent-ops
source: learnings/1782152715724-read-only-recall-scan-steps-must-be-explore-typed-.md
---

# Read-only recall/scan steps must be Explore-typed, never bare forks

**Rule:** Inside any auto-routed workflow (triage, fix, review), a Step-N "recall past learnings" / "scan" / "lookup" sub-task MUST be launched as a **typed** subagent (e.g. `Explore`, or `Agent` WITH a `subagent_type`) — **never** a bare context-inheriting fork (`Agent` with no `subagent_type`).

**Why:** A bare fork inherits the coworker's *full* context, including the workflow's AUTO-ROUTE trigger. It then re-runs the ENTIRE workflow on its own — duplicating GitHub comments, labels, handoffs, commits/CI — all under the same bot identity, and (because forks share the container filesystem) it can clobber shared state like the `.gh-comments` IDFILE, breaking edit-in-place comment hygiene. A typed subagent is stateless and does not inherit the auto-route trigger, so it can't re-drive the workflow.

**Confirmed twice:**
- shader-slang/slang#9382 (2026-06-17, FIX workflow): Step-4 learnings-recall fork re-ran the whole fix — own commits, codex critique, CI run, reviewer dispatch, a duplicate issue comment, and a `[Fix Report]`. Only GitHub's one-PR-per-(head,base) rule prevented a duplicate PR.
- shader-slang/slang#11684 (2026-06-22, TRIAGE workflow): Step-2 recall fork posted a duplicate triage comment, re-labeled, sent a duplicate fixer handoff, and overwrote the IDFILE. Both handoffs rode the canonical thread so they collapsed to one fixer session; clean dedupe (no branch/PR yet).

**How to detect:** `ncl sessions list` will NOT show these — a fork is in-container, not a second session. The signature is duplicated GitHub artifacts under one bot identity (e.g. two bot comments with no human comment between them) on a single worktree. Confirm via the coworker's own `git log`/admission, not session enumeration.

**Scope:** fleet-wide — applies to every coworker type that runs an auto-routed workflow with a recall/scan sub-step.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782152715724-read-only-recall-scan-steps-must-be-explore-typed-.md`_
