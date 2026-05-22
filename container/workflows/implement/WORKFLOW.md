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

1. **Setup** — If no plan exists at `{{report.path}}` and the task is non-trivial, run the plan workflow autonomously before proceeding — do not ask permission. Load the plan from `/workspace/agent/reports/{{target_slug}}.md`. Extract the file list + verification plan.

   **Use a separate git worktree per issue/PR.** Don't edit the main checkout directly. Create a dedicated worktree so this session's work is isolated from other concurrent sessions, and so review comments on this PR can be addressed independently:

   ```bash
   git worktree add /workspace/agent/wt-{{target_slug}} -b dev/<coworker>/{{target_slug}}
   cd /workspace/agent/wt-{{target_slug}}
   ```

   All editing, building, and committing happens inside that worktree. Other sessions own their own worktrees in parallel — no shared working tree, no merge conflicts on shared dirty state.

   **[MUST NOT] Worktree isolation.** Sibling sessions write to their own `wt-<other-target>/` dirs in the same group filesystem; you can SEE them but **never read, write, mv, rm, or `git worktree remove`** them. Cross-session reads can produce silent wrong-source confusion; cross-session deletes have caused observed mid-build failures in concurrent fixer chains. If `/workspace` runs out of disk, **report `blocked` to parent** with status + `df -h /workspace` output — do **not** clear space by deleting sibling worktrees or build dirs.

   Never ask for permission between steps; document judgment calls in the log and proceed. Plan loop limit: loop back to the plan workflow at most **2 times** total — on the third failure, escalate. On restart: read `{{implementation_log.path}}` and `git log --oneline -10` to determine current progress; `cd` back into your worktree and resume from the last incomplete step.
2. **Recall** {#recall} — Before making changes, spawn an `Agent` subagent to scan prior shared learnings for hits on `{{target}}`. Keeps your context clean — you never read the full INDEX or learning files yourself.

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to <target>. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

   If a hit looks directly applicable, read just that file before continuing.
3. **Reproduce** {#reproduce} — for bug fixes: write a failing test that demonstrates the issue. For features: start with a skeleton that shows the gap. Commit separately so CI shows the delta.
4. **Change** {#change} — make the minimum edit that matches the plan. Stay in one subsystem. Follow existing style. For doc-only changes, edit existing files before creating new.
5. **Verify** {#verify} — For any build >5 min: (a) notify parent via `send_message` with format "⚙️ [step] — [branch] — [status/ETA]", (b) schedule a `schedule_task` watchdog (`new_session=false`, recurrence `*/30 * * * *`) that checks completion and cancels itself — cancel it immediately when the build finishes. Full test suite + format + lint + typecheck. If updating a PR, address review feedback before re-running. Failure handling: if verify fails after **2 independent fix attempts**, commit the failing state with a `wip:` prefix, write a failure summary to `{{implementation_log.path}}`, and escalate to the orchestrator — do not loop.
6. **Ship** — descriptive commit linking the issue, push branch, open or update PR with summary + test plan. Push branch and open PR immediately — do not wait for human confirmation. Notify parent via `send_message`: 'PR opened: <url>'.
