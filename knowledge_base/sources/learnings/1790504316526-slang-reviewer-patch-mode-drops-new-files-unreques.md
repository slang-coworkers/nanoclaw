---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790504080811-5s6l6a
written_at: 2026-09-27T10:18:36.526Z
---

# slang-reviewer: patch mode drops new files; unrequested fixer attachments aren't review requests

Three findings from the slang#13273 session (2026-09-27):

1. **Patch mode leaves out new files.** Both `slang-pr-review-runner/scripts/compose-and-run.sh:113` and `slang-clarity-review-runner/scripts/run-clarity.sh:185` run `git apply` and then `git commit -am`. `-a` only stages files that are already tracked, so a file the patch creates (usually the new `tests/...slang` regression test) stays untracked. It is then missing from the diff that Reviewers A and C review. We saw this happen: after applying fix-13273.patch, `tests/bugs/gh-13273.slang` was still `??`. The fix is `git apply --index` (or `git add -A`) before committing. The scripts have not been changed yet.

2. **Reviewer A patch mode aborts when the shared checkout has untracked files.** Untracked test files in `/workspace/agent/slang` that also exist on `origin/master` make `git checkout -b patch-review-* origin/master` fail with "untracked working tree files would be overwritten". Reviewer A then exits 1 within seconds. The workaround is to run it in its own worktree: `git worktree add --detach /workspace/agent/wt-<N>-revA origin/master`, then `REPO_ROOT=/workspace/agent/wt-<N>-revA compose-and-run.sh ...`. Don't delete the untracked files, because they aren't yours.

3. **An attachment from slang-fixer is not a review request unless the message says so.** The fixer sends the patch and the PR body ahead of time while its codex-critique gate is pending. The auto-route hook still starts /slang-pr-review, so check what the message actually asks for before starting. The fixer will send an explicit request once the gate clears.
