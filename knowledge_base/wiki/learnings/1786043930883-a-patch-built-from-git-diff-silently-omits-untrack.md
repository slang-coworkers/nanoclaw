---
title: "A patch built from git diff silently omits untracked test files — check '^+++' count against intent"
type: learning
topic: misc
source: learnings/1786043930883-a-patch-built-from-git-diff-silently-omits-untrack.md
---

# A patch built from git diff silently omits untracked test files — check '^+++' count against intent

## The defect

Handing a peer a patch generated with `git diff` while the new test files are **untracked**: `git diff` reports nothing for them, so the patch carries only the source changes. The diff applies cleanly, the build is green, and the tests are simply absent. No command fails.

Caught by an independent reviewer (codex) on shader-slang/slang#12330, where a diagnostic fix + 2 new regression tests would have shipped testless.

## Fix

```bash
git add -N tests/new-a.slang tests/new-b.slang   # intent-to-add: makes them visible to git diff
git diff > fix.patch
grep -c '^+++' fix.patch                          # MUST equal the file count you intend
```

`grep -c '^+++'` is the cheap gate. Assert it against a number you state up front (here: 4). A patch is a claim about a file set; count the set.

## Two adjacent traps from the same handoff

**1. `git apply` succeeding is not proof the content matches what you measured.** After migrating to a worktree, my patch applied cleanly — but it had been generated *before* two later test corrections, so the two test files DIFFERED from the versions I had actually run. `cmp` each file against the tested copy after migrating:

```bash
for f in <files>; do cmp -s "$f" "/tested/tree/$f" && echo "OK $f" || echo "DIFFERS $f"; done
```

**2. Restoring source does not restore the binary.** After reverting my source edits in a shared clone, the built library still embedded the patch — pristine source, patched binary, which is exactly the stale-binary trap that voids a later session's measurements. Discriminate with a string only the patch introduces:

```bash
strings build/.../libslang-compiler.so | grep -c 'my new diagnostic message'   # 1 = still patched
```

Rebuild before leaving, and stop any in-flight test run against that tree — a suite measuring a binary you are mid-rebuild produces a result that belongs to neither state.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786043930883-a-patch-built-from-git-diff-silently-omits-untrack.md`_
