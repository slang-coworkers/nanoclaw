---
name: implement
license: MIT
type: workflow
description: "Execute a plan — make the file change, verify, ship. Use after /plan. Every cycle produces a tested, committed change."
requires: [code.read, code.edit, test.run, test.gen, repo.pr]
uses:
  skills: []
  workflows: [plan]
params:
  target: { type: string, required: true }
  branch: { type: string, required: false }
produces:
  - implementation_log: { path: "/workspace/agent/fixes/{{target_slug}}.md" }
  - patch: { path: "git commit on {{branch}}" }
---

# Implement

Execute a plan. Diagnosis lives in `/plan`; this workflow is pure execution.

## Invariants

- Plan first. If non-trivial and no plan exists, run `/plan`. If the plan is stale or wrong, go back to `/plan` — don't re-diagnose here.
- Evidence first. For bug fixes, write a failing test before the fix.
- Keep scope narrow. Surface unrelated observations in the log, don't act on them.
- Tests, format, and lint must pass before ship.

## Steps

1. **Setup** — If no plan exists at `{{report.path}}` and the task is non-trivial, run the plan workflow autonomously before proceeding — do not ask permission. Load the plan from `/workspace/agent/reports/{{target_slug}}.md`. Branch off and extract the file list + verification plan. Never ask for permission between steps; document judgment calls in the log and proceed. Plan loop limit: loop back to the plan workflow at most **2 times** total — on the third failure, escalate. On restart: read `{{implementation_log.path}}` and `git log --oneline -10` to determine current progress; check out the working branch and resume from the last incomplete step.
2. **Reproduce** {#reproduce} — for bug fixes: write a failing test that demonstrates the issue. For features: start with a skeleton that shows the gap. Commit separately so CI shows the delta.
3. **Change** {#change} — make the minimum edit that matches the plan. Stay in one subsystem. Follow existing style. For doc-only changes, edit existing files before creating new.
4. **Verify** {#verify} — For any build >5 min: (a) notify parent via `send_message` with format "⚙️ [step] — [branch] — [status/ETA]", (b) schedule a `schedule_task` watchdog (`new_session=false`, recurrence `*/30 * * * *`) that checks completion and cancels itself — cancel it immediately when the build finishes. Full test suite + format + lint + typecheck. If updating a PR, address review feedback before re-running. Failure handling: if verify fails after **2 independent fix attempts**, commit the failing state with a `wip:` prefix, write a failure summary to `{{implementation_log.path}}`, and escalate to the orchestrator — do not loop.
5. **Ship** — descriptive commit linking the issue, push branch, open or update PR with summary + test plan. Push branch and open PR immediately — do not wait for human confirmation. Notify parent via `send_message`: 'PR opened: <url>'.
