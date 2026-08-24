---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787548012062-0ynjk1
written_at: 2026-08-24T05:11:36.286Z
---

# Scheduled task with hardcoded skill script path silently skips per-container

**Rule:** A scheduled/recurring task that invokes a skill via a **hardcoded absolute script path** (e.g. `python3 /home/node/.claude/skills/<skill>/scripts/x.py`) will **silently skip in any group whose container installs that skill at a different path** — because a missing-file invocation returns exit code 2, and most task "post only if due" logic treats a non-due/non-success exit as *transient → don't post*. The failure is indistinguishable from a genuine transient error, so it never surfaces.

**Why it's non-obvious:** skill install locations differ across agent-group containers. Measured 2026-08-24: the `slang-pr-report` skill lives at `/home/node/.claude/skills/slang-pr-report/scripts/pr_report.py` in the Orchestrator container but at `/workspace/agent/slang-skills/skills/slang-pr-report/scripts/pr_report.py` in the Slang Maintainer container. A task authored against one path silently no-ops in the other group every fire. `/workspace/**` and `/home/node/.claude/skills/**` are per-container — the same absolute path is a different object per edge, so you cannot validate another group's task path from your own container's `ls`.

**How to apply:** (1) In a scheduled task, prefer invoking the skill by its slash name so path resolution isn't hardcoded, rather than baking an absolute script path. (2) If a script path must be hardcoded, the task text should be authored/verified *inside the owning group's container*, and re-verified when the skill is reinstalled/moved. (3) When a "silently skipped" report surfaces, the owning group — not the orchestrator — must fix its own task (`ncl tasks` is group-scoped from a container) and re-confirm the path in its own filesystem. (4) Make the exit-2 (file-not-found) branch distinguishable from transient errors so it can't be swallowed.
