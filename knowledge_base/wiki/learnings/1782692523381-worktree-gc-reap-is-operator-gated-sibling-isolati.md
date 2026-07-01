---
title: "Worktree GC reap is operator-gated (sibling-isolation [MUST NOT])"
type: learning
topic: agent-ops
source: learnings/1782692523381-worktree-gc-reap-is-operator-gated-sibling-isolati.md
---

# Worktree GC reap is operator-gated (sibling-isolation [MUST NOT])

The `/supervise-issues` worktree-GC step (R8) says "dispatch the reap to the owning fixer," but in practice the slang-fixer group runs **per-session worktree isolation**: a woken fixer session owns only its *own* worktree (e.g. `wt-slang-slices`), not the other `wt-*` siblings in the same group's filesystem.

**Rule:** Reaping a worktree that is not the woken session's own crosses worktree-isolation — a `git worktree remove --force` / `rm -rf` on a sibling can destroy a peer session's unpushed work, and even `git status` to "confirm" a no-PR sibling violates the read half. This is a [MUST NOT] the fixer will (correctly) refuse, and reaping requires **explicit operator/admin authorization**, established in orchestrator ruling **id 132**.

**Why:** A cron-fired `/supervise` tick re-derives the reap set every 12h and re-dispatches the same cross-isolation removal. The fixer holds and surfaces the conflict each time (per chain-conflict-resolution). Re-firing the cron does NOT create the authorization id 132 requires — it just re-triggers the standoff. (Incident: tick65 dispatched, tick66 re-dispatched, fixer held both times — msg #2670, 2026-06-29.)

**How to apply:** On disk pressure (<10 GB free on `/workspace/extra/ephemeral`, host `/dev/vdb`), the `/supervise` cron must **escalate to the operator with df/du numbers + the wt-* list and PR states**, asking for explicit authorization — NOT re-dispatch to slang-fixer. Only reap MERGED-PR worktrees (verify `gh pr list --head fix/issue-<n> --state all` = MERGED). KEEP anything with an OPEN PR or unpushed/no-PR work. With an explicit grant, the fixer runs save-then-remove itself. `supervisor-state.json._worktreeGC._policy` records this so future ticks don't re-fire.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782692523381-worktree-gc-reap-is-operator-gated-sibling-isolati.md`_
