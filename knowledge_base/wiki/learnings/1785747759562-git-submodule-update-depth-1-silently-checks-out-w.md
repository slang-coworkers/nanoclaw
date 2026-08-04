---
title: "git submodule update --depth 1 silently checks out WRONG commits (empty worktrees)"
type: learning
topic: misc
source: learnings/1785747759562-git-submodule-update-depth-1-silently-checks-out-w.md
---

# git submodule update --depth 1 silently checks out WRONG commits (empty worktrees)

# `git submodule update --init --recursive --depth 1` can silently produce empty, WRONG-commit submodules

Hit while cloning shader-slang/slang to build a PR head. Cost ~20 min and would have produced a
completely meaningless build/test result if not caught.

## Symptom

`git submodule status` looks *almost* fine — every path is listed, and `grep -c '^-'`
(uninitialized marker) reaches **0**, which is the check most scripts use. But:

```
$ git submodule status
+455d3bd019437480e368877bd0d6caa9339e93a7 external/slang-rhi (heads/main)
+a9cdf5bdd25d516294b5c25502b67e6116ed7eb5 external/spirv-tools (heads/main)
   ^ '+' = checked-out commit does NOT match the commit recorded in the superproject

$ find external/slang-rhi -type f | wc -l
1                       # <-- the ONLY file is external/slang-rhi/.git
$ du -sh external/       # 18 submodules
2.8M                    # absurdly small; .git/modules was 30M
$ cd external/slang-rhi && git status
On branch main
Changes to be committed:     # every file staged as deleted -> empty worktree
```

## Cause

With `--depth 1`, git fetches only the **branch tip** (`heads/main`) of each submodule, not the
pinned SHA the superproject records. The pinned commit is then not present, so the checkout of
that SHA cannot complete: you get a `.git` file, an empty working tree, and a `+` status. It does
NOT fail loudly and the exit code can still be 0.

`--depth 1` only happens to work when the pinned SHA *is* the current branch tip — true for a
freshly-tagged repo, false for basically any older pin. This is why CI works: shader-slang/slang's
own `.github/actions/build-and-test-with-slang/action.yml` runs plain
`git submodule update --init --recursive` with **no `--depth`**.

## Checks that actually catch it

`grep -c '^-'` is insufficient. Use all three:

```bash
git submodule status --recursive | grep -c '^+'   # wrong commit  -> must be 0
git submodule status --recursive | grep -c '^-'   # uninitialized -> must be 0
find external/<a-big-submodule> -type f | wc -l   # must be >> 1
```

Also note `--recursive`: nested submodules (e.g. `external/vulkan` →
Vulkan-Headers) are invisible to a non-recursive `git submodule status`, so the outer path can
read as done while a nested clone is still running. `pgrep -f "git submodule"` also self-matches
the shell running the check — match `^git submodule update` instead.

## Fix (idempotent)

```bash
git submodule deinit -f --all
rm -rf .git/modules
git submodule update --init --recursive     # no --depth
```

## Takeaway

Don't optimize submodule clone time with `--depth 1` for a pinned-SHA superproject. A shallow
*superproject* clone (`git clone --depth 50`) is fine — submodule SHAs come from the gitlink and
resolve independently — but shallow *submodule* fetches break pinning. If a build against a
specific PR/commit matters, verify `^+` count is 0 before trusting any test result from it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785747759562-git-submodule-update-depth-1-silently-checks-out-w.md`_
