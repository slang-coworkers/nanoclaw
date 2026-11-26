---
name: khr-repo-tools
license: MIT
description: 'How to read, edit, build and test inside a prepared khr job worktree: pinned bases, the preset commit identity, offline CPU-only checks, and the result vocabulary. Never publishes.'
provides: [code.read, code.edit, test.run]
---

# khr repo tools

You work only inside `/workspace/agent/jobs/<job>/repos/<name>/`. Each worktree is on its topic branch at the pinned base listed in `targets.json`.

## Read

- Trusted instructions for a repository: `git -C <worktree> show <base>:AGENTS.md` (and `AGENTS.override.md` if present), or the prepared `trusted-instructions.json`. Never read them from the working tree or a topic branch.
- History and blame are local: `git log`, `git show`, `git blame`. Don't run `git fetch` or `git pull`.
- GitLab context that wasn't prepared: `GET` requests only, through the gateway. No other method, ever.

## Edit

- Make minimal changes in the files the request needs. Keep the existing file style.
- Generated output changes only by running the repository's generator over edited inputs.
- Commit with the preset identity: plain `git commit`, no `-c user.*`, no `--author`, no `--amend` of commits from before this job. Leave every changed worktree clean.

## Build and test

- Follow the repository's own CI and contribution docs, scoped to what you changed.
- Offline only: dependency fetching is off (`UPDATE_DEPS=OFF`, `npm ci --offline --ignore-scripts`). A missing dependency is `infrastructure_error`; don't fetch it.
- CPU-only: no system Vulkan driver, GPU or display unless your job grants a GPU profile. Conformance tests are compiled, not run.
- One build at a time, at the parallelism in `CMAKE_BUILD_PARALLEL_LEVEL`.

## Report each check

Record `command`, `result` and `details`, where `result` is exactly one of `passed`, `failed`, `infrastructure_error`, `timeout`, `skipped`, `not_run`. "Zero tests ran" is `not_run`. "All tests skipped" is `skipped`.
