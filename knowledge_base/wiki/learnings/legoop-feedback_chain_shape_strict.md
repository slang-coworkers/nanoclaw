---
title: "Strict reply-routing in 4-tier issue chain — replies hop back along the dispatch path, never bypass to the orchestrator"
type: learning
topic: agent-ops
source: learnings/legoop-feedback_chain_shape_strict.md
---

# Strict reply-routing in 4-tier issue chain — replies hop back along the dispatch path, never bypass to the orchestrator

For chains shaped `Orchestrator → Triage → Fixer → Reviewer`, replies must hop back **along the same path the work came in on**, one tier at a time:

- **Reviewer → Fixer** (never to triage or orchestrator)
- **Fixer → Triage**, with reviewer findings rolled into fixer's 5-bullet upstream report. Fixer is the single voice that talks to triage; reviewer's data is *included*, not *forwarded separately*.
- **Triage → Orchestrator**, with fixer's report (and reviewer-via-fixer) summarized into triage's own 5-bullet report.
- **Orchestrator → human** when uncertain — never sideways to a peer like `slang-maintainer` or any other coworker as a "let me ask the expert" fallback.
- The exception: **PR description**. Whichever coworker authors the PR (typically fixer) writes the executive summary into the PR body, including upstream context (triage memo) and downstream verification (reviewer findings). The PR body is the persistent rollup; chat reports are transient.

**Why:** Witnessed on shader-slang/slang#11349 (May 29 2026): fixer ancestor-routed `[Plan Report]` straight to orchestrator, bypassing triage. Orchestrator then dispatched to `slang-maintainer` for "spec decision required" — wrong escalation: that's a peer coworker, not a human. Result: dashboard fragmented across 3 thread tiles, raw fixer plan dumped on orchestrator with no triage filtering, and an unauthorized peer-to-peer escalation hop. Triage exists to filter/prioritize/aggregate — bypassing it defeats the chain.

**How to apply:** When editing base spine fragments (`container/spines/base/tool-instructions/agents.md`, `container/spines/base/context/chain-reporting.md`):
- Forbid the "Agent reply routed back to ancestor session" path for routine reports — that runtime feature exists for cases where parent is the only viable recipient, not for skipping intermediate tiers.
- Mandate `ask_user_question` (the existing MCP tool, same UX as `install_packages` approval — amber dot in dashboard sidebar) for orchestrator's "I'm uncertain" → human escalation. NOT a `<message to="<peer-coworker>">`.
- Reviewer findings travel as text in fixer's parent report, not as a separate hop.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/legoop-feedback_chain_shape_strict.md`_
