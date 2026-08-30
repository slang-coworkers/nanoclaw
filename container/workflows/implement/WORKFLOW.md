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

## Steps

1. **Setup** — No plan at `{{report.path}}` + non-trivial → run `/plan` first. Load `/workspace/agent/reports/{{target_slug}}.md`; extract file list + verification plan. **One git worktree per issue/PR — never the main checkout:**
   ```bash
   git worktree add /workspace/agent/wt-{{target_slug}} -b dev/<coworker>/{{target_slug}}
   cd /workspace/agent/wt-{{target_slug}}
   ```
   All editing/building/committing happens there. **[MUST NOT] Worktree isolation.** You can SEE sibling `wt-<other-target>/` dirs but **never read, write, mv, rm, or `git worktree remove`** them (wrong-source confusion, mid-build failures). `/workspace/agent/` full → **report `blocked` to parent** with `df -h /workspace/agent` (the worktree volume — a separate, larger disk than the always-healthy root mount); don't delete sibling worktrees. Never ask permission between steps; log judgment calls. Loop back to plan at most **2 times**; third failure → escalate. On restart: read `{{implementation_log.path}}` + `git log --oneline -10`, `cd` into your worktree, resume.
2. **Recall** {#recall} — Before changing anything, spawn an `Agent` subagent to scan prior learnings (keeps context clean); wiki-first, raw fallback:
   ```
   Agent(prompt="Check if /workspace/shared/wiki/index.md exists. IF YES: read it (it is a small catalog); open at most 2 concept pages with limit=60 to reach their `## TL;DR`. Links inside the wiki are relative to /workspace/shared, so `](wiki/concepts/x.md)` means `/workspace/shared/wiki/concepts/x.md`, identify concept pages relevant to <target>, read up to 2 concept pages and follow their links to cited learnings if needed. If no concept fits, Grep /workspace/shared/wiki/ for keywords. IF NO wiki/ dir: fall back to Grep /workspace/shared/learnings/ for keywords and reading at most 3 hits. Return ≤5 bullets — title, 1-line summary, file path. No hits → 'no prior hits'.")
   ```
3. **Reproduce** {#reproduce} — Bug fixes: failing test. Features: skeleton showing the gap. Commit separately so CI shows the delta.
4. **Change** {#change} — Minimum edit matching the plan; one subsystem, existing style. Doc-only: edit existing files before creating new.
5. **Verify** {#verify} — Build >5 min: notify parent via `send_message` ("⚙️ [step] — [branch] — [status/ETA]") and delegate the build to an `Agent` subagent (it blocks until completion — no polling task). Run full test suite + format + lint + typecheck. PR update: address review feedback first. Fails after **2 independent fix attempts** → commit failing state with `wip:` prefix, write failure summary to `{{implementation_log.path}}`, escalate — don't loop.
6. **Ship** {#ship} — Descriptive commit linking the issue, push branch, open/update PR with summary + test plan. Don't wait for human confirmation. Notify parent: 'PR opened: <url>'.
