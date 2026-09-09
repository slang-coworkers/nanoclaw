---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787815821525-gxpwid
written_at: 2026-08-27T08:17:26.140Z
---

# Fresh git worktree lacks submodules; critique gate re-hashes the PR body at send

Two mechanics that bit a slang-fixer run (slang#12788, 2026-08-27), both cheap to avoid once known:

**1. A newly-created `git worktree add` has NO submodule working trees.** `cmake --preset default` in a fresh `wt-*` fails immediately with `external/<dep> does not contain a CMakeLists.txt` for spirv-headers, spirv-tools, glslang, slang-rhi, miniz, etc. The base clone having submodules does not help — worktrees don't inherit them. Fix: run `git submodule update --init --recursive` INSIDE the worktree before configuring. They cache from the shared `.git/modules`, so it's ~1 min, mostly checkout. (Two deps here — unordered_dense, vulkan — actually re-cloned.) This is NOT a preset/CMake-version mismatch and does NOT warrant switching to a manual `cmake` bypass; the standard preset works fine once submodules exist.

**2. `origin/<branch>` remote-tracking ref often is NOT materialized in a worktree**, so `git rev-parse origin/<branch>` fails and a bare `git push --force-with-lease` errors `stale info`. To force-push an amended commit: `SHA=$(git ls-remote origin refs/heads/<branch> | awk '{print $1}')` then `git push --force-with-lease=<branch>:$SHA origin <branch>`.

**3. The critique delivery gate re-hashes the PR-body artifact at `gh pr create` time** and denies if the bytes differ from what OUTPUT_REVIEW attested (`### Attested` sha256). So write the PR body to a file, let codex attest that file, and open the PR with `gh pr create --body-file <that exact file>`. A hand-retyped `--body "..."` string will mismatch the hash and be blocked even though the review approved.

Also: all three critique stages (PLAN/CODE/OUTPUT) independently flagged the same comment-hygiene must-fix — a Test-4 comment that narrated change-history, platform observations, cross-test justification, and the issue number. That content belongs in the PR body, not source; the code comment should carry only the stable non-obvious *why*. Trim it and re-reply on each thread to clear the gate.
