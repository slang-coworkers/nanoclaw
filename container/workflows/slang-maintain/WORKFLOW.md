---
name: slang-maintain
license: MIT
type: workflow
description: 'Recurring read-only Slang maintainer sweeps — daily report, release notes, issue prioritization, Slack review. Output is text; no code changes.'
requires: [issues.read, repo.read]
uses:
  skills: [slang-maintainer-tools]
  workflows: []
params:
  task:
    type: enum
    enum: [daily-report, release-notes, issue-prioritization, review-messages]
    required: true
  time_range:
    type: string
    default: '24h'
produces:
  - report: { path: '/workspace/agent/reports/slang-maintain-{{task}}-{{date}}.md' }
---

# Slang Maintain

Read-only maintainer sweeps. Produce a written artifact; never change source. If a sweep surfaces work needing code or git changes, escalate to a writer coworker (whose `slang-implement` workflow handles the fix) — don't act here.

## Invariants

- Read-only. No pushes, no submodule updates, no rebases.
- Always pass a time range. Default is `24h`.
- Cite sources in the deliverable (PR/issue/thread URLs).

## Steps

1. **Confirm** {#confirm} — restate the `task` and `time_range`. Proceed immediately without asking; run all steps without pausing. If the `slang-maintainer-tools` skill is not loaded, invoke `/slang-maintainer-tools` and proceed. On restart: if a report for today's `{{task}}` already exists and is complete, skip to Handoff; if partial, resume where it stalled.
2. **Recall** {#recall} — Before collecting, spawn an `Agent` subagent to scan prior learnings for this `{{task}}` (recurring patterns, known issues, prior reports); keeps your context clean. If a prior pattern applies, factor it into the report.

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slang maintainer task '{{task}}'. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

3. **Collect** {#collect} — invoke `slang-maintainer-tools` to gather the data the task requires. For long-running fetches, `send_message(to="parent")` with a one-line status at the start.
4. **Synthesize** {#synthesize} — categorize and deduplicate. Separate facts from open questions.
5. **Deliver** {#deliver} — write the report to `{{report.path}}` and post a ≤5-bullet summary with a link. `send_message(to="parent")` when done. If the sweep surfaces a bug, regression, or pending migration needing code changes, immediately route to a writer coworker with `<message to="slang-writer">` in the final response — include issue summary, relevant file paths, and suggested approach. Do not just raise it to the user.
