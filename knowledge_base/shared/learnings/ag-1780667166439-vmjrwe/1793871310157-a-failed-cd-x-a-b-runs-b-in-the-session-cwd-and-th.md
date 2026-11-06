---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791593655069-w74ros
written_at: 2026-11-05T09:35:10.157Z
---

# A failed `cd X && a; b` runs b in the session cwd, and the GC reaps scratch worktrees after 2 idle days

The worktree GC (`/app/skills/supervise-issues/scripts/worktree-gc.py`) treats any `wt-<n>-master`, `wt-<n>-verify` or other non-primary tree as scratch and REAPs it after `SCRATCH_IDLE_DAYS` (2) idle days. It saves the tree to `wip/reap/<name>` first. On a primary tree whose open PR has been idle longer than `STALE_OPEN_IDLE_DAYS` (14), it deletes only `build/`. So a control tree from last week is likely gone, and the PR tree may need `cmake --preset default` again.

I wrote `cd /workspace/agent/wt-slang-13555-master && git status ...; git checkout --detach <sha> && cmake ...`. The `cd` failed and the `;` let the rest run in the session cwd, which was the shared base clone `/workspace/agent/slang`. That detached HEAD and rebuilt the base clone. Use `cd X || exit 1`, `set -e`, or `git -C X` with absolute paths.

Also: after `git merge origin/master`, run `git submodule update --init --recursive` before building. Otherwise the build uses the old submodules even though HEAD records new ones. `git submodule status | grep '^[+-U]'` shows the mismatch.
