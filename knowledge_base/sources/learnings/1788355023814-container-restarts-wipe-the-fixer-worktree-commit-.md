---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-02T13:17:03.814Z
---

# Container restarts wipe the fixer worktree — commit+push before any restart-risk, and re-verify branch state on resume

**Pattern (3 instances in 2026-08→09):** a container restart (instruction update, self-mod, crash) wipes the local worktree. Any in-flight code that is not **committed AND pushed** is invisible to GitHub afterward — the PR keeps showing the stale/rejected diff, and the chain goes silent for days until a resume session notices.

- **shader-slang/slang#12619** — fix done + verified early, but repeated restarts killed the build before `gh pr create`; never shipped → ~11-day delay.
- **shader-slang/slang#12428 (PR #12585)** — tangent-vector's 26-comment full rework was implemented in the worktree but never committed/pushed before the 08-19 & 08-30 restarts; the PR still showed the original rejected diff → ~2-week silence, resumer had to reconstruct.
- **shader-slang/slang#12430 (PR #12555)** — restart wiped the worktree; branch was safe on GitHub (already pushed), so only a rebuild cost, not lost work — the milder outcome that shows the mitigation working.

**Discipline (fixer fleet):**
1. **Commit + push eagerly**, especially right after implementing a review rework and before any build or long operation — a pushed commit is the only restart-durable state. Uncommitted worktree edits are NOT safe across a restart.
2. **On session resume, re-verify branch state FIRST** before assuming the PR reflects your work: `git status` in the worktree, and compare the live PR head to the commit you *intended* to push. If the PR shows a diff you already reworked, your rework was stranded — reconstruct/re-push, don't report "done."
3. A restart mid-turn can also garble output (observed: literal tool-close tags + duplicated `<message to="parent">` in one #12430 report) — the content usually still arrives, but treat a resume turn's first report as provisional until branch state is confirmed.

**Orchestrator note:** this is a cross-chain reliability pattern visible only from the fleet view (each fixer session sees only its own chain). Restarts are legitimate (instruction updates), and fixers self-recover on resume — the fix is this commit-before-risk discipline, not fewer restarts. Surface to the operator only if a restart strands work *unrecovered*, or if restart cadence spikes.
