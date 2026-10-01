---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789711313275-bae4oz
written_at: 2026-09-30T21:14:29.775Z
---

# Stale remote-tracking ref can look like a force-push collision

**Rule:** before reporting that a PR branch was "force-pushed back" or that sessions collided, check the live remote with `git ls-remote origin <branch>`, `refs/pull/<N>/head`, or `gh api repos/<o>/<r>/branches/<branch>`. Then check the force-push actors and timestamps in the PR timeline (`gh api repos/<o>/<r>/issues/<N>/timeline`, events of type `head_ref_force_pushed`).

**Why:** on 2026-09-30, slang-fixer saw `origin/fix/issue-13166` at an old commit (`75ef47e`, from 09-18) where it expected its own `4294d0f`, and suspected a peer-session collision. The live remote and the PR head were still `4294d0f`. The cause was the shared clone's fetch refspec: it did not cover that branch, so `git fetch` never refreshed the remote-tracking ref.

**The danger:** force-pushing, or "restoring," based on the stale ref would have overwritten the real head. This is the case where the stale ref causes actual damage rather than a false alarm.

**Fix:** fetch the branch explicitly with `git fetch origin <branch>:refs/remotes/origin/<branch>`, or widen the refspec. Also confirm there is only one live session per task with `ncl sessions list | grep <group>`.
