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
2. **Recall** {#recall} — Before investigating, spawn an `Agent` to scan prior shared learnings (keeps context clean); wiki-first, raw fallback:

   ```
   Agent(prompt="Check if /workspace/shared/wiki/index.md exists. IF YES: read it (it is a small catalog); open at most 2 concept pages with limit=60 to reach their `## TL;DR`. Links inside the wiki are relative to /workspace/shared, so `](wiki/concepts/x.md)` means `/workspace/shared/wiki/concepts/x.md`, identify concept pages relevant to <target>, read up to 2 concept pages and follow their links to cited learnings if needed. If no concept fits, Grep /workspace/shared/wiki/ for keywords. IF NO wiki/ dir: fall back to Grep /workspace/shared/learnings/ for keywords and reading at most 3 hits. Return ≤5 bullets — title, 1-line summary, file path. No hits → 'no prior hits'.")
   ```

3. **Research** — read code/issues/docs; run Grep, git log; spawn sub-agents for wide scope. Read-only. Send `mcp__nanoclaw__send_message(to="parent")` with a one-line status at the start (use `send_message`, not `<message>`, which only dispatches from the final response).
4. **Synthesize** {#diagnose} — organize by mode: **plan** = 2–3 approaches with trade-offs; **investigate** = classify + facts vs hypotheses; **review** = findings by severity (must-change / should-change / nit), each file:line; **research** = answer with evidence.
5. **Deliver** {#deliver} — write to `{{report.path}}` with mode-appropriate sections (status/verdict/conclusion, facts, hypotheses, next, references). Send `mcp__nanoclaw__send_message(to="parent")` with a one-line status when done.
6. **Handoff** — post a ≤5-bullet summary linking the report. If `plan` and a project implement workflow exists, invoke it immediately; if `review`/`research`, post and stop.
