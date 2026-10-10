---
name: implement
license: MIT
type: workflow
description: 'Execute a plan — make the change, verify, ship. Use after /plan.'
requires: [code.read, code.edit, test.run, test.gen, repo.pr]
uses:
  skills: []
  workflows: [plan]
params:
  target: { type: string, required: true }
  branch: { type: string, required: false }
produces:
  - implementation_log: { path: '/workspace/agent/fixes/{{target_slug}}.md' }
  - patch: { path: 'git commit on {{branch}}' }
---

# Implement

Pure execution of a plan; diagnosis lives in `/plan`.

## Invariants

- Plan first. No plan + non-trivial → run `/plan`. Stale/wrong plan → back to `/plan`, don't re-diagnose here.
- For bug fixes, write a failing test before the fix.
- Narrow scope: log unrelated observations, don't act on them.
- Tests + format + lint must pass before ship.
- **Build delegation.** A build over 5 min runs inside one `Agent` subagent — never inline, never polled: the subagent blocks until completion. Before starting it, `send_message(to="parent")` with `⚙️ [step] — [branch] — [status/ETA]`; when it returns, act on the result on the same turn.
- **Two attempts, then the blocked procedure.** A failed build, test, or plan loop gets one fix and one re-run (a clean rebuild counts as the second attempt); the second failure triggers the blocked procedure — never a third try.
- **Blocked procedure.** Commit the current state with a `wip:` prefix including the failure log, write the failure summary to `{{implementation_log.path}}`, send your role's report (Report formats) to parent with `Status: blocked`, the last 30 log lines, what was tried, and the worktree path, then end the turn. Cannot reproduce → the same with `Status: blocked — cannot reproduce`.

These invariants are part of every workflow that extends this one, whatever steps it overrides.

## Steps

1. **Setup** — No plan at `{{report.path}}` + non-trivial → run `/plan` first. Load `/workspace/agent/reports/{{target_slug}}.md`; extract file list + verification plan. One git worktree per issue/PR — never the main checkout — on branch `fix/issue-<number>` (the webhook router recognizes a coworker PR by this exact prefix):
   ```bash
   git worktree add /workspace/agent/wt-{{target_slug}} -b fix/issue-<number>
   cd /workspace/agent/wt-{{target_slug}}
   ```
   All editing/building/committing happens there. **[MUST NOT] Worktree isolation.** Sibling `wt-<other-target>/` dirs share this filesystem: you can SEE them but never read, write, mv, rm, or `git worktree remove` them. Disk full → report `blocked` to parent with `df -h /workspace/agent` (the worktree volume — a separate, larger disk than the root mount); never reclaim space from sibling dirs. **Collision** — another session's `active-work/<target>` sentinel is under 30 min old: relay and stand down (Decision table). Judgment calls follow the **Ambiguity** principle. Plan loops: back to `/plan` at most twice, then the **blocked procedure** (Invariants). On restart: read `{{implementation_log.path}}` + `git log --oneline -10`, `cd` into your worktree, resume.
2. **Recall** {#recall} — Recall per the **Workspace › Recall rule** with `<task>` = `{{target}}`.
3. **Reproduce** {#reproduce} — Bug fixes: failing test. Features: skeleton showing the gap. Commit separately so CI shows the delta. Cannot reproduce → the **blocked procedure** (Invariants).
4. **Change** {#change} — Minimum edit matching the plan; one subsystem, existing style. Doc-only: edit existing files before creating new. **Architect the commit series so a reviewer can read the change as steps.** Foundations first: each preparatory refactor, rename, extracted helper or new type is its own commit with no behaviour change, buildable and green on its own. Then the behaviour change, one commit per feature or fix, with the test that proves it (the Reproduce commit already leads the series). Follow-ups (formatting, docs) last. Message: `component: imperative summary` + one paragraph of why; a reviewer should be able to approve commits one at a time. Never one "fix everything" commit, never a refactor mixed into a behaviour change. When the work landed as a lump, re-split it: `git reset --soft <base>`, re-commit by slice with `git add <files>`, and re-verify each slice builds.
5. **Verify** {#verify} — Build per **Build delegation** (Invariants); run full test suite + format + lint + typecheck. PR update: address review feedback first. Failure → **Two attempts, then the blocked procedure** (Invariants).
6. **Ship** {#ship} — Check the commit series reads in review order (test → fix → cleanup, each buildable), push the branch, open or update the PR as a **draft** (`gh pr create --draft`) with summary + test plan; never mark it ready-for-review or merge it. Notify parent: `PR opened: <url>`.
