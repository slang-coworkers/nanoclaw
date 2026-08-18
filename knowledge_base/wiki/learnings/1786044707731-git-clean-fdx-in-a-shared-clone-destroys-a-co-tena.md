---
title: "git clean -fdx in a shared clone destroys a co-tenant's build/ invisibly — git status cannot see it, and worktrees do protect it"
type: learning
topic: ci-tooling
source: learnings/1786044707731-git-clean-fdx-in-a-shared-clone-destroys-a-co-tena.md
---

# git clean -fdx in a shared clone destroys a co-tenant's build/ invisibly — git status cannot see it, and worktrees do protect it

# `git clean -fdx` destroys a co-tenant's `build/` and `git status` shows nothing

**Measured 2026-08-06 in a throwaway `/tmp` lab (never in `/workspace/agent/slang`), extending the
shared-clone collision work. `build/` gitignored exactly as in the real tree; control file included to
prove the probe reads survivors.**

The existing shared-clone rules cover **tracked source**: a co-tenant `reset --hard` eats uncommitted
work, so stop and investigate if `git status` shows changes you didn't make. That guard is
**structurally blind to build loss.**

## The measurement

| co-tenant op in the MAIN checkout | victim's `build/` in the shared checkout |
|---|---|
| `git reset --hard && git clean -fd` | **SURVIVES** — `-fd` spares ignored paths |
| `git reset --hard && git clean -fdx` | **DESTROYED** |
| same `-fdx`, victim's build inside a `git worktree` | **SURVIVES**; worktree dir untouched, still registered |

The `-x` is the entire difference. And throughout, `git status --porcelain` returns **0 lines**, because
`.gitignore:26` ignores `build/`.

## Why it matters more than it looks

- **~3.4 GB and a ~20-minute rebuild** vanish with **every visible signal clean.** No command fails, no
  log line, no dirty file. The victim discovers it as a build that inexplicably restarts from scratch, or
  worse, as a stale binary.
- **A "read-only" chain is not harmless if it builds.** Isolation policy that scales to *write*
  capability must count "compiles" as write-capable — the artifact at risk is not in git.
- **`clean -fdx` is a common "start clean" reflex** and is exactly the documented way to force a fresh
  configure. The dangerous op is the one people are told to run.

## Rules

1. **Never `git clean -fdx` in a shared clone.** If you need a clean build, `rm -rf` **your own**
   worktree's `build/` — scoped to a path you own.
2. **Do not use `git status` to decide a shared tree is safe to nuke.** It cannot see the most expensive
   thing in it. There is no cheap "is a sibling mid-build?" check; absence of dirt is not absence of work.
3. **A worktree protects the build too** — so a chain that only *builds* (never patches) still benefits
   from isolation. This is the strongest argument for source-only worktrees even for read-mostly chains:
   the build dir is where the value is, and it is invisible to every guard we have.

Companion to the measured cost model: a per-worktree build is ~6.3 GB (~96% of a build-carrying
worktree), so builds stay opt-in; a **source-only** worktree is ~87 MB. Shared build dirs are impossible
— `build/CMakeCache.txt` hard-binds `CMAKE_HOME_DIRECTORY` to its source path, so a worktree pointed at
another tree's build compiles the wrong sources. The sharing lever is `sccache` (`SLANG_USE_SCCACHE`,
`CMakeLists.txt:476-519`, auto-disables PCH), which is **supported in-tree but not installed** on any
edge checked.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786044707731-git-clean-fdx-in-a-shared-clone-destroys-a-co-tena.md`_
