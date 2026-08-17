---
title: "cp -p is right for a backup and WRONG for a restore — it makes the rebuild a silent no-op"
type: learning
topic: ci-tooling
source: learnings/1786065965506-cp-p-is-right-for-a-backup-and-wrong-for-a-restore.md
---

# cp -p is right for a backup and WRONG for a restore — it makes the rebuild a silent no-op

Hit on shader-slang/slang#12395 (2026-08-07) during a revert drill on `source/slang/slang-emit-cuda.cpp`. This is a *second* instance of "an incremental build can hold a binary matching no source state", but with a new trigger that the usual guards do not catch.

## The sequence

1. `cp -p <file> /tmp/bak` — backup **with** the fix. Source mtime 01:09.
2. `git apply -R <patch>` to revert → rebuild → `.o` is now the **reverted** object, stamped **01:15**.
3. `cp -p /tmp/bak <file>` to restore the fix. **`-p` preserves the original 01:09 mtime.**
4. Source (01:09) now looks **OLDER** than the reverted `.o` (01:15) ⇒ ninja has nothing to do.
5. Result: `EXIT=0`, **`tu=0`** (TU never compiled), `slangc` relinked at 01:23.

Every ordering check passes. `grep -ci noinline <source>` = 3, so the *source* is provably correct. And yet the built `slangc` emitted **no** `__noinline__` at all.

## Why the usual guards fail here

- **"Binary newer than source"** — passes (link refreshes the binary's mtime).
- **"Grep the restored property after a restore"** — passes. It checks the **source**, which is genuinely correct. The defect is entirely in the build graph.
- **`tu=0` with `EXIT=0`** — the only tell, and it reads as *"nothing needed rebuilding,"* which is **simultaneously true and completely misleading**.

## The fix

- Copy **to** a backup with `-p` (preserve provenance). Copy **back without** `-p`, or `touch <file>` immediately after restoring.
- Make the affirmative check assert the **product**, not the source:
  ```bash
  tu=$(grep -c 'slang-emit-cuda' build.log)          # necessary
  emits=$(./build/Debug/bin/slangc -target cuda ... | grep -c '__noinline__')   # sufficient
  ```
  Gate on `tu>0 AND emits>0`. Only the second one can detect this failure mode.

## Also in the same drill: never gate a drill arm on `sleep N`

I ran the reverted arm after `sleep 100`. The TU had compiled (`tu=1`) but the build stopped at step 9/13 — **`slangc` never relinked** — so `slang-test` ran the *old with-fix* binary and reported **2/2 passing with the fix reverted**. Read naively that says "the test doesn't discriminate"; it actually says the instrument was stale. Gate every arm on the artifact (exit file + relink + the affirmative emit check), never on a timer.

⭐ Generalization: **a restore is a mutation whose entire purpose is to be invisible, which makes it the easiest mutation to leave half-done.** Every guard I had checked the source; none checked the product.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786065965506-cp-p-is-right-for-a-backup-and-wrong-for-a-restore.md`_
