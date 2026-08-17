---
title: "CONSOLIDATED: GitHub `.github/workflows/*` pushes & elevated permissions (bot can't; orchestrator's PAT pushes the patch on your behalf)"
type: learning
topic: misc
source: learnings/1780558703303-CONSOLIDATED-github-workflows-and-elevated-permissions.md
---

# CONSOLIDATED: GitHub `.github/workflows/*` pushes & elevated permissions (bot can't; orchestrator's PAT pushes the patch on your behalf)

*Authoritative consolidation (2026-06-04) of the nv-slang-bot `workflows`-permission notes (1780318200469, 1780327332964, 1780461974353) and the stale-master push-rejection fix (1780334228990), plus the cross-fork push gotchas (1779983283876). Supersedes those per-incident notes; they remain for history.*

## The rule (current setup, 2026-06-04)

- **Default GitHub work runs as `nv-slang-bot`** — code push to `fix/issue-*` / `dev/<folder>/*` branches on `shader-slang/*`, plus issues, PRs, labels, comments. This works; ignore the lying `gh auth status` probe (see the GitHub auth/ops consolidation).
- **The bot App token lacks the `workflows` permission.** Any commit that creates/edits a file under `.github/workflows/` is rejected on push — and the rejection is **atomic**: the *entire* push fails, including the non-workflow refs/files bundled in it:
  ```
  ! [remote rejected] <branch> (refusing to allow a GitHub App to create or update
    workflow `.github/workflows/<f>.yml` without `workflows` permission)
  ```
- **Only the orchestrator holds a personal PAT with `workflow` scope.** Every other container asks the orchestrator when it needs an elevated permission for a PR. For a workflow change a coworker must **NOT** silently self-block, and must **NOT** fall back to "leave the diff as a maintainer to-do in the PR body" (that was the pre-PAT guidance — now stale).
- **Distinguish pushing workflow FILES from DISPATCHING workflows.** This permanent block is only about *pushing/editing* `.github/workflows/*` files. *Running* workflows via API (`gh workflow run`, `gh run rerun --failed`) is a separate surface that was transiently 403-blocked by a gateway routing bug and is **RESTORED as of 2026-06-17** — see the auth-&-ops CONSOLIDATED's "Workflow DISPATCH … RESOLVED" section. Don't conflate the two.

## The handoff — workflow patches only

1. Keep the **non-workflow** part of the change on the branch and push it as the bot (goes fine).
2. Produce a **git patch set** of just the `.github/workflows/*` change (`git format-patch` or `git diff -- .github/workflows/`) and send it up to the **orchestrator** via `send_file` to parent, with the target branch + base sha.
3. **The orchestrator applies and pushes the workflow patch on the coworker's behalf using its PAT.** Only workflow patches take this route; everything else the coworker pushes directly as the bot.

## Stale-`origin/master` false rejection (same error text, different cause)

The `workflows`-permission rejection can also fire when **your own commit touches no workflow file**: the local clone's `origin/master` is stale and carries recent `.github/workflows/*` ancestor commits not on the true remote tip, so the push tries to (re)create them. Fix by rebasing onto the real tip so the push contains only your commit:

```bash
git ls-remote origin refs/heads/master          # the REAL current tip (often != local origin/master)
git fetch origin master
git rebase --onto origin/master <stale-base-sha> <branch>
git show --stat <sha> | grep .github/workflows  # confirm: empty
git push --force-with-lease origin <branch>     # feature/draft branch only
```

Establish up front: branch off `origin/master` only **after** a fresh `git fetch origin master`. Default branch is **master**, not main. If after a clean rebase your commit *still* touches workflows, it's the genuine permission case above → patch up to the orchestrator.

## Cross-fork PR gotcha (when pushing via a personal fork instead of origin)

`gh pr create` defaults `maintainer_can_modify=true`, which the bot can't grant on someone else's fork → `422 fork_collab Fork collab can't be granted by someone without permission`. Post via REST with the flag off:

```bash
gh api -X POST repos/<upstream>/pulls \
  -f title="…" -f head="<fork-owner>:<branch>" -f base="master" \
  -F body=@/tmp/pr-body.txt -F maintainer_can_modify=false
```

Prefer pushing `fix/issue-*` branches **directly to origin** (`shader-slang/slang`) — same-repo PRs avoid both the fork-collab flag and the stale-fork workflow-ancestor problem.

## Reusable-workflow map (which CI a `-D…` flag reaches)

- `ci-slang-build.yml` ← called by `ci.yml` (PR jobs; macOS passes `os: macos`) **and** `populate-sccache.yml`.
- `cmake-options-build.yml` ← from `cmake-options.yml` (weekly/dispatch).
- `ci-slang-coverage.yml` ← from `coverage-nightly.yml`.
- A `-D…` injected only into `ci-slang-build.yml` does **not** reach the cmake-options / coverage (macOS) jobs.

## Minor CMake gotcha (seen on the same tasks)

`option(SLANG_GITHUB_TOKEN "…" "")` is a **BOOL** cache var defaulting to **OFF**, not an empty string — `if(${VAR})` sees OFF (false). Verify empirically (`grep CMakeCache.txt`); don't assume the `""` third arg makes it empty.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780558703303-CONSOLIDATED-github-workflows-and-elevated-permissions.md`_
