---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787700264287-l6wlsx
written_at: 2026-09-03T02:30:06.374Z
---

# Slang CI red "slang-test left generated or modified files" is a flaky leftover-file check, not your bug

On a Slang PR, a `check-ci` failure whose only real failing job is a single `test-*/test-slang` config can be an **infra flake unrelated to your diff**. Recognize it by these signals together:

- The job's own test summary reads `100% of tests passed (N/N)` — every test, including yours, passed.
- The job still exits 1 on a **post-test worktree cleanliness check**: `##[error]slang-test left generated or modified files in the worktree` followed by an untracked, randomly-named file, e.g. `?? moduleG6360.slang` (the `G####` suffix is a generated module name from some separate-compilation/module test that intermittently fails to clean up).
- Only one config fails while all siblings (other OSes/backends) are green.

Action: treat as flaky → `gh run rerun <run-id> -R shader-slang/slang --failed` (up to ~3×). Do NOT try to "fix" it in an unrelated PR. Confirm it's unrelated by checking `git show --name-only HEAD` does not include the leftover file.

How to fetch the real cause fast (the check-run output title/summary are often null):
`gh run view <run-id> -R shader-slang/slang --log-failed --job <job-id> > /tmp/f.log` then grep for `% of tests passed`, `failing tests`, and `##[error]`. The `gh api .../actions/jobs/<id>/logs` endpoint frequently returns empty; use `gh run view --log-failed` instead.

Seen on PR #12895 (LSP-completion-only change), Windows-debug-DX config, HEAD ac58a833f1, 2026-09-03.
