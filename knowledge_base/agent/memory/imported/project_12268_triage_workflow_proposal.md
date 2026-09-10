---
name: project_12268_triage_workflow_proposal
description: "slang#12268 jkwak triage-workflow proposal — CLOSED informational; fleet does NOT write board status field"
metadata: 
  node_type: memory
  type: project
  originSessionId: d8246fbc-9afe-4d1f-b516-40cff9f670a4
---

# slang#12268 — "Establish the workflow of triaging process"

CLOSED as **informational** (2026-07-30). Opened title-only by maintainer
**jkwak-work**, then populated via
[comment 5135590680](https://github.com/shader-slang/slang/issues/12268#issuecomment-5135590680)
with a mermaid flowchart proposing a **human** triage process mapped to the
project board `status` field:

- F1 New (status empty) → F2 Maintainer quick triage (*In triage*) → **P0?**
  - P0 → maintainer drives assignment now → F4 (*TODO*)
  - non-P0 → F3 Scrum-leads weekly meeting → assign → F4
- F3 explicit **"Waiting for more info from reporter"** park node
- F4 (*TODO*) accepts → F5 *In Progress*; "someone else" → back to F3
- F5 → F6 PR *In Review* → major changes → back to F5; approved & merged → F7 *Closed*

Triager posted one short mapping reply
([comment 5135628671](https://github.com/shader-slang/slang/issues/12268#issuecomment-5135628671))
and closed. No `@nv-slang-bot` ask, no compiler issue → not actionable as a task.

**Round 2 (2026-07-31):** jkwak posted a companion **PR-side** flow
([comment 5147178374](https://github.com/shader-slang/slang/issues/12268#issuecomment-5147178374))
— origin (community/bot/team) → P1 draft → P2 auto-assign → P3 review → "sensible?"
gate → P4 Ready+CI → CI → P5 optional 2nd reviewer → P6 approve → P7 merge queue →
Merged; with two open questions (Q1: add a "Closed without merge" terminal? Q2: does
the community path need maintainer workflow-approval before CI?). Triager answered
([comment 5147233889](https://github.com/shader-slang/slang/issues/12268#issuecomment-5147233889))
and re-closed informational.

## Durable fact (the reusable part)

**Our automated triage/fix/review fleet already occupies F2 (reproduce/classify/
verdict/labels/Type), F3's park (reproducer/clarification request), and F5–F6
(fixer draft PR + reviewer) — BUT it writes comments/labels/Issue-Type ONLY. It
does NOT move the project board `status` field.** Driving the
F2→F3-park→TODO→In-Progress→In-Review status transitions automatically would be a
deliberate wiring step, not current behavior. Triager offered to align once
maintainers + scrum leads settle it.

No `status` field *values* were disclosed (generic mechanics only → no
project-confidentiality concern).

## CORRECTION — fork-PR CI gating is by origin-of-head, NOT by author

Main mis-framed this in Round 2 and the triager corrected it. The accurate fact:

- GitHub public-repo Actions gate **fork-based** PRs from first-time/outside
  contributors behind a manual "Approve and run workflows" click (Settings→Actions→
  *Fork PR workflows from outside collaborators*; public default = require approval
  for first-time contributors).
- **Our bot fixer does NOT hit that gate.** It opens PRs from **same-repo branches**
  (`fix/issue-<N>`), which run CI immediately. The gate applies only to
  **fork-origin** heads.
- So the distinguishing axis is **origin-of-head (fork vs. same-repo branch)**, NOT
  who authored the PR. Community = fork → gated; bot/team = same-repo branch → skips
  the gate. That's why the three lanes converge at auto-assign but only the community
  lane needs a "maintainer approves workflow run" node before P4→CI.

## Re-engagement

Held-open on canonical thread `gh-issue-shader-slang/slang-12268`. A substantive
human reply re-opens; a thanks/ack closes. If maintainers ask to wire board-status
automation, this is the origin context.
