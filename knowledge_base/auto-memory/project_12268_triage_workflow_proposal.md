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

## Re-engagement

Held-open on canonical thread `gh-issue-shader-slang/slang-12268`. A substantive
human reply re-opens; a thanks/ack closes. If maintainers ask to wire board-status
automation, this is the origin context.
