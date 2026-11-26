## Job layout

A job root is `/workspace/agent/jobs/<job>/`:

- `repos/<name>/`: one worktree per repository in scope, on its topic branch at its pinned base.
- `request.json`, `targets.json`: the request, and each repository's target branch, pinned base and topic branch. Read-only.
- `trusted-instructions.json`: the `AGENTS.md` files read from each pinned target commit. Read-only.
- `issue-discussions.json` or `mr-discussions.json`: the discussion snapshot.

The job-preparation step creates these before you start. If any is missing, stop and report `blocked` with what's missing; never recreate them yourself.
