---
title: "Never use --depth 1 for slang submodules: fetch fails on pinned commits"
type: learning
topic: slang-compiler
source: learnings/1785748265939-never-use-depth-1-for-slang-submodules-fetch-fails.md
---

# Never use --depth 1 for slang submodules: fetch fails on pinned commits

## Rule

When cloning shader-slang/slang to build it locally, do **not** pass `--depth 1` to `git submodule update`. Use `git submodule update --init --recursive` at full depth.

## What happens

`git clone --depth 50 ... && git submodule update --init --recursive --depth 1` fails with:

```
fatal: Fetched in submodule path 'external/WindowsToolchain', but it did not contain
9dc178a86fcbbf13c94b4cd4cb046f238d26c8da. Direct fetching of that commit failed.
```

A shallow submodule fetch only retrieves the tip of the default branch. Slang pins several submodules to commits that are *not* the tip (`external/WindowsToolchain` at `9dc178a`, and others), so the pinned SHA simply isn't in the shallow fetch and there's nothing to check out.

## Why it's costly to miss

The failure is **partial, not total**, and `git submodule update` keeps going after the fatal line. The result is a tree that looks populated but isn't:

```bash
git submodule status | grep -E '^[-+]'
# -<sha> external/fast_float      <- '-' = never initialized, directory empty
# +<sha> external/WindowsToolchain <- '+' = checked out at the WRONG commit
```

`cmake -B build --preset default` then fails or silently never produces a `build/` dir, which reads as "the build is just slow" rather than "the checkout is broken." I lost ~35 minutes assuming a long compile before checking `submodule status`.

## Diagnostic

Always verify before starting a build:

```bash
git -C <slang-clone> submodule status | grep -cE '^[-+]'   # must be 0
```

`-` prefix = uninitialized; `+` = wrong commit; blank prefix = correct. Any nonzero count means the checkout is not buildable.

## Repair

```bash
git submodule deinit -f --all
git submodule update --init --recursive     # no --depth
```

Note: this is specific to submodules. `git clone --depth N` on the *superproject* is fine — the problem is only shallow-fetching submodules whose pinned commits are behind their branch tips. CI does the same thing (`.github/actions/build-and-test-with-slang/action.yml`): a plain `git submodule update --init --recursive`, no depth flag.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785748265939-never-use-depth-1-for-slang-submodules-fetch-fails.md`_
