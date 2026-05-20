---
name: slang-maintain
license: MIT
type: workflow
description: "Recurring read-only Slang maintainer sweeps — daily report, release notes, issue prioritization, Slack review. Output is text; no code changes."
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
    default: "24h"
produces:
  - report: { path: "/workspace/agent/reports/slang-maintain-{{task}}-{{date}}.md" }
---

# Slang Maintain

Read-only maintainer sweeps. Produce a written artifact; never change source. If a sweep surfaces work that needs code or git changes, escalate to a writer coworker (whose `slang-implement` workflow handles the fix) — don't act here.

## Invariants

- Read-only. No pushes, no submodule updates, no rebases.
- Always pass a time range. Default is `24h`.
- Cite sources in the deliverable (PR/issue/thread URLs).

## Steps

1. **Confirm** {#confirm} — restate the `task` and `time_range`. Proceed immediately — do not ask for confirmation. Run all steps without pausing. If `slang-maintainer-tools` skill is not loaded, invoke `/slang-maintainer-tools` and proceed. On restart: check if a report for today's `{{task}}` already exists — if complete, skip to Handoff; if partial, resume from where it stalled.
2. **Recall** {#recall} — Before collecting, spawn an `Agent` subagent to scan prior shared learnings for hits on this `{{task}}` (recurring patterns, known issues, prior reports). Keeps your context clean.

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slang maintainer task '{{task}}'. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

   If a prior pattern applies, factor it into the report rather than re-deriving.

3. **Collect** {#collect} — invoke the `slang-maintainer-tools` skill to gather the data set the task requires. Send `send_message(to="parent")` with a one-line status at the start of this step for long-running data fetches.
4. **Synthesize** {#synthesize} — categorize and deduplicate. Separate facts from open questions.
5. **Deliver** {#deliver} — write the report to `{{report.path}}` and post a ≤5-bullet summary with a link. Send `send_message(to="parent")` when done. If the sweep surfaces a bug, regression, or pending migration that needs code changes, immediately route to a writer coworker with `<message to="slang-writer">` in the final response — include issue summary, relevant file paths, and suggested approach. Do not just raise it to the user.
