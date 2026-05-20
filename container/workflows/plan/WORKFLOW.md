---
name: plan
license: MIT
type: workflow
description: "Plan, investigate, review, or research — any task that produces a written deliverable. Output is TEXT, never file changes."
requires: [issues.read, code.read, doc.read]
uses:
  skills: []
  workflows: []
params:
  target: { type: string, required: true }
  mode: { type: enum, default: "plan", enum: ["plan", "investigate", "review", "research"] }
produces:
  - report: { path: "/workspace/agent/reports/{{target_slug}}.md" }
---

# Plan

Any task that ends in a written artifact: a plan, an investigation, a review, or a research memo. No file changes — hand off to the implement workflow when code/docs need to change.

## Invariants

- Label facts vs hypotheses.
- Cite concrete files, lines, or URLs.
- Text output only.

## Steps

1. **Understand** — restate the ask. Identify `mode` (plan / investigate / review / research). If scope is ambiguous, state your interpretation and proceed — do not ask. Never pause for human confirmation between steps. On restart: if a report already exists at `{{report.path}}`, check if it has a Conclusion/Verdict section — if complete, skip to Handoff; if partial, resume from where it stalled.
2. **Recall** {#recall} — Before doing your own investigation, spawn an `Agent` subagent to scan prior shared learnings for hits on `{{target}}`. Keeps your context clean — you never read the full INDEX or learning files yourself.

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to <target>. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

   If a hit looks directly applicable, read just that file before continuing.
3. **Research** — read code, issues, docs; run Grep, git log; spawn sub-agents for wide scope. Stay read-only. Send `mcp__nanoclaw__send_message(to="parent")` with a one-line status at the start of this step. Use `send_message` (not `<message>`), since `<message>` blocks only dispatch from the final response.
4. **Synthesize** {#diagnose} — organize the evidence by mode:
   - **plan**: 2–3 approaches with trade-offs.
   - **investigate**: classify + facts vs hypotheses.
   - **review**: findings by severity (must-change / should-change / nit), each with file:line.
   - **research**: answer the question with evidence.
5. **Deliver** {#deliver} — write the deliverable to `{{report.path}}` with mode-appropriate sections (status/verdict/conclusion, facts, hypotheses, next, references). Send `mcp__nanoclaw__send_message(to="parent")` with a one-line status when done.
6. **Handoff** — post a ≤5-bullet summary with a link to the report. If mode is `plan` and a project implement workflow is available for this coworker type, invoke it immediately — do not wait for human confirmation. If mode is `review` or `research`, post the summary and stop.
