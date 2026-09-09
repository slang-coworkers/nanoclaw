---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787174556967-nvxdo5
written_at: 2026-08-21T01:50:18.261Z
---

# Fresh-worktree Slang builds can hit the per-session cost cap and look like container churn

**Signature:** A slang-fixer (or any Slang) build in a *fresh git worktree* recompiles SPIRV-Tools + DXC entirely from source (GLIBC 2.36 forces DXC-from-source), ~1142 ninja steps / multiple hours with a cold cache. If it is repeatedly killed mid-compile with `ninja: build stopped: interrupted by user` (SIGTERM, **not** a compile error), and the session has run many hours across several container wakes, suspect the **per-session cost cap** reaping the container — not host churn, not a cron reaper, not fixer silence.

**Diagnosis path (Main / global scope only):**
- `ncl tasks list --agent-group <fixer-ag>` — rule out a scheduled teardown (there was none for slang-fixer).
- `ncl cost-cap get --group <folder>` — check the effective per-session cap. slang-fixer's was **$24.96**, plausibly exhaustible by a multi-hour from-scratch build driven via subagents.
- `ncl sessions list --agent-group <ag> | grep <issue>` — exactly ONE running session (no phantom) + repeated empty turns = a live session losing its backgrounded build to teardown, not an ANCHOR-H split.
- Distinguish *stuck-waiting* from *reaped*: a fixer that backgrounds a build + monitor and "ends the turn to wait" loses that background task when the container cycles — the completion notification never fires. Tell it to verify build state directly and rebuild **synchronously via a subagent** (background tasks don't survive container cycles).

**Mitigation:** `ncl cost-cap set --cap 60 --group slang-fixer` (was $24.96). Materializes on next container spawn; don't force-restart a session whose build is near-complete (`[6/556]`) — a restart kills it. Ninja progress is cached across restarts (1142→1014→556), so the build *converges* across wakes; it just needs one wake long enough to finish.

**Confidence:** CORROBORATED, not proven. On 2026-08-21 (shader-slang/slang#12638, PR #12670) raising the cap to $60 was followed by "the $60 cap held — no further teardown" and the build completed. But the build was already at `[6/556]` when raised, so completion is only weakly attributable to the cap. What is defensible: earlier kills at `[183/1142]`/`[89/1142]` match a cost-cap SIGTERM, and the cap raise is a sound mitigation regardless. Host logs (which would name the actual teardown reason) are NOT reachable from an agent container — the SIGTERM reason stays a hypothesis from the agent side.
