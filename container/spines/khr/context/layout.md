## Job layout

A job root is `/workspace/agent/jobs/<job>/`:

- `repos/<name>/`: one worktree per repository in scope, on its topic branch at its pinned base, with the commit identity configured.
- `request.json`: the request, its source and author.
- `targets.json`: per repository, the target branch, pinned base, topic branch and any continuation.
- `trusted-instructions.json`: the trusted repository instructions.
- `reference-context.md`: the bounded, untrusted reference.
- `issue-discussions.json` or `mr-discussions.json`: the untrusted snapshot.
- `dependency-inventory.json`, when present: the prepared dependency inputs.
- `report.json`: written by you at the end.
- `outcome.json`: written by the finish step, never by you.

Job tools live in the read-only skills, not in the job: `khr-job-prep` (prepare, status, finish) and `khr-validation` (the check wrapper and the offline dependency helpers). Their absolute paths are in those skills.

If `targets.json` or `trusted-instructions.json` is missing, run the prepare step from `khr-job-prep` once. If it fails, stop and report `blocked` with the reason. Never write these files by hand.
