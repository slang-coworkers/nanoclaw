# check-submodules can go red repo-wide when an upstream flips its default branch

## What happened

`shader-slang/slang`'s `Check Submodule Pointers` gate went from 96/100 green to **4/4 failing across 3 unrelated PRs** in ~3.5 hours (2026-08-05 22:33Z onward). No `external/` commit had landed since 07-23, so nothing in the repo changed.

Cause: `extras/check-submodule-commits.sh` resolves each submodule's tracked ref **live from the upstream remote's current default branch** (`git ls-remote --symref <url> HEAD`) when `.gitmodules` has no `branch =` override. `external/mimalloc` has no override. Upstream `microsoft/mimalloc` flipped its default branch `main` → `main3`, and slang's pin `8c532c32c3c96e5ba1f2283e032f69ead8add00f` is reachable from `main` but **not** from `main3`.

Verified from first principles, independent of any CI log:
```
git ls-remote --symref https://github.com/microsoft/mimalloc.git HEAD   # => ref: refs/heads/main3
# pin fetches fine; merge-base --is-ancestor: reachable from main, NOT from main3
```

The pin never moved — the goalpost did.

## Why it matters

1. **A submodule-pin gate that resolves the ref live has an external failure mode.** The check is correct and firing correctly; the input moved under it. `git fetch`-style reruns cannot fix it (the same live ref re-resolves, the commits are immutable) — this is the "rerun-CANNOT-succeed" class. Fix is a repo change: add `branch = main` to the mimalloc entry in `.gitmodules`, or re-pin to a `main3`-reachable commit.
2. **Red ≠ blocking.** This gate is not a required status check (its own header comment says so, and it is absent from `check-ci`'s `needs:`). Empirical proof: on merge-group sha `49584a0890d3`, check-submodules failed at 22:34Z and **PR 12352 merged at 23:52Z anyway**. Don't infer "queue stalled" from a red gate — check whether a PR actually merged past it.
3. **Don't attribute an eviction to a run that postdates it.** check-submodules on #12353's sha completed at 01:12Z, but the eviction was at 00:41Z. Always compare the failing job's completion time against the `RemovedFromMergeQueueEvent` timestamp, and derive the cause from the event's `beforeCommit` sha.

## How to spot the class

When any *repo-wide* gate flips from a long green streak to ~100% failure across unrelated PRs with no relevant repo commit, suspect a **live external lookup** inside the check (default-branch resolution, a "latest" tag, an unpinned download) rather than a per-PR flake. Cross-PR spread is the tell: 1 PR ⇒ maybe code; 3+ unrelated PRs ⇒ shared input moved.
