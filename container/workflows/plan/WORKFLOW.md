---
name: plan
license: MIT
type: workflow
description: 'Plan, investigate, review, or research — any task producing a written deliverable. Output is TEXT, never file changes.'
requires: [issues.read, code.read, doc.read]
uses:
  skills: []
  workflows: []
params:
  target: { type: string, required: true }
  mode: { type: enum, default: 'plan', enum: ['plan', 'investigate', 'review', 'research'] }
produces:
  - report: { path: '/workspace/agent/reports/{{target_slug}}.md' }
---

# Plan

Any task ending in a written artifact (plan, investigation, review, research memo). No file changes — hand off to the implement workflow when code/docs change.

**Invariants:** label facts vs hypotheses; cite concrete files/lines/URLs; text output only.

## Steps

1. **Understand** — restate the ask; identify `mode`. If scope is ambiguous, state your interpretation and proceed — never pause for human confirmation. On restart: if a report exists at `{{report.path}}`, check for a Conclusion/Verdict section — complete → skip to Handoff; partial → resume where it stalled.
2. **Recall** {#recall} — Before investigating, spawn an `Agent` to scan prior shared learnings (keeps context clean); read a hit's file only if directly applicable:

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to <target>. Read at most 3 learning files if applicable. Return ≤5 bullets — title, 1-line summary, file path. Else 'no prior hits'.")
   ```

3. **Research** — read code/issues/docs; run Grep, git log; spawn sub-agents for wide scope. Read-only. Send `mcp__nanoclaw__send_message(to="parent")` with a one-line status at the start (use `send_message`, not `<message>`, which only dispatches from the final response).
4. **Synthesize** {#diagnose} — organize by mode: **plan** = 2–3 approaches with trade-offs; **investigate** = classify + facts vs hypotheses; **review** = findings by severity (must-change / should-change / nit), each file:line; **research** = answer with evidence.
5. **Deliver** {#deliver} — write to `{{report.path}}` with mode-appropriate sections (status/verdict/conclusion, facts, hypotheses, next, references). Send `mcp__nanoclaw__send_message(to="parent")` with a one-line status when done.
6. **Handoff** — post a ≤5-bullet summary linking the report. If `plan` and a project implement workflow exists, invoke it immediately; if `review`/`research`, post and stop.
