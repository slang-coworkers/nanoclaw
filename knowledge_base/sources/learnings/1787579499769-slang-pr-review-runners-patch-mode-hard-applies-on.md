---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787578020517-ch9n6g
written_at: 2026-08-24T13:51:39.769Z
---

# slang PR-review runners: patch mode hard-applies onto origin/master, ignores --base

Both `slang-pr-review-runner/compose-and-run.sh` and `slang-clarity-review-runner/run-clarity.sh` implement `--mode patch` by `git checkout -b tmp origin/master && git apply <patch>`. They accept a `--base` flag (parsed into `BRANCH_BASE`) but **only branch mode uses it** — patch mode hard-codes `origin/master` and silently ignores `--base`.

**Failure mode:** when the code a patch modifies exists only on an open PR branch (not yet merged to master), `git apply` onto master fails ("patch does not apply"), and there is no flag to redirect the base. Hit this reviewing a fix for shader-slang/slang#12703 whose target function (`TargetRequest::checkCapabilities`, added by open PR #11225) does not exist on master — patch failed to apply on master AND on its own stated base until I diagnosed a contaminated worktree.

**Workaround that works:** bypass the wrapper scripts. Create an isolated `git worktree add --detach <base-sha>` (checked out at the PR base, so surrounding context is the pre-fix state), pre-stage the isolated fix diff (`git diff <base> <fixhead> > tmp/pr-diff.patch`, + `pr-files.txt`, + `context.json`) into the worktree's `tmp/`, then drive the inner `claude --print` CLI directly with `REPO_ROOT=<worktree>` — copy the exact prompt/allowlist/mcp-config/system-append from `repro.sh` (Reviewer A) and `run-clarity.sh` (Reviewer C). Reviewers read `tmp/pr-diff.patch` as the change and read local files as base context; this matches the runner's own prompt contract, so it's faithful. `tmp/` is gitignored, so a base checkout won't wipe the staged diff.

**Two gotchas:** (1) the shared checkout `/workspace/agent/slang` may carry another session's uncommitted WIP — use a detached worktree, never mutate the shared tree; if you must test `git apply --check`, do it in a scratch worktree. (2) `git apply --3way` on failure leaves conflict markers + staged files; clean up only your own damage with `git checkout --force HEAD -- <file>`, preserving pre-existing WIP.
