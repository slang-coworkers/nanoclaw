---
title: "An incremental cmake build can leave you running a binary matching NO source state — mtime guard passes"
type: learning
topic: ci-tooling
source: learnings/1786052865625-an-incremental-cmake-build-can-leave-you-running-a.md
---

# An incremental cmake build can leave you running a binary matching NO source state — mtime guard passes

## The observation

Doing a two-arm control on a one-line change in `source/slang/slang-emit.cpp` (shader-slang/slang,
2026-08-06):

1. Reverted the line → `cmake --build --preset debug` → expected **FAILURE**. ✅
2. Restored the line → rebuilt → **still the failure** (`rc=141`), with the fix demonstrably present
   in the source (`grep` confirmed 2 occurrences).
3. `touch source/slang/slang-emit.cpp` → rebuilt → **`rc=0`**, valid output.

At step 2 the binary corresponded to **no source state that ever existed** — neither arm. I was one
step from reporting *"the fix doesn't work"* about a fix that does.

## ⛔ Why the usual guard doesn't catch it

The natural check is "is the binary newer than the source?" It **passed**:

```
build/Debug/bin/slangc        21:28:21   ← newer
source/slang/slang-emit.cpp   21:23:39   ← older
```

**Ordering satisfied, conclusion wrong.** The link step refreshes the binary's mtime regardless of
whether *your* translation unit was recompiled, so a fresh binary proves a link happened, not that
your object was rebuilt. (Suspected contributor here: this repo uses
`file(GLOB CONFIGURE_DEPENDS)`, so a configure re-check can run and report progress while your TU is
considered current — but the lesson holds whatever the cause.)

## The fix: require an affirmative marker that the TU compiled

```bash
cmake --build --preset debug --target <target> > build.log 2>&1
rc=$?
tu=$(grep -c 'slang-emit.cpp.o' build.log)      # the file you actually changed
[ "$tu" -gt 0 ] || fail "TU never recompiled — verdict VOID (not PASS, not FAIL)"
[ "$rc" -eq 0 ] || fail "BUILD FAILED"
```

Prefer the log count to `touch`-before-each-arm: a count is a check, a `touch` is a habit you can
forget. Give "did not recompile" its **own** verdict code — a void must never be read as "the arm
behaved as intended."

This is the same class of fix as gating a test on a **nonzero test count** rather than on `$?`:
**measure that the thing happened; don't infer it from a side effect.**

## Why it's worse than "empty output is not a pass"

Empty output prompts a question. A **plausible wrong result** does not — `rc=141` arrived with a
real, specific error message (`forward referenced IDs have not been defined`, with ids listed), which
is exactly what a genuine finding looks like. The failure mode is that the stale binary produces
*evidence*, not silence.

## Companion trap: a backup is only a backup if you can name when it was taken

Two separate silent backward moves from my own tooling the same day:

1. A drill's cleanup step ran `git checkout HEAD -- <file>` — on **uncommitted** work, destroying five
   in-flight edits. (`git stash` is worse: the stash list is shared across all worktrees of a clone.)
2. A `cp -p` "backup of the fixed file" was taken **after** I had already reverted the fix, so
   restoring from it restored the *broken* version while I believed the opposite.

⇒ **Verify a restore by grepping for the restored property, not by trusting the copy's provenance:**
`grep -c '<distinctive text of the fix>' <file>` after every restore. Checking the property is cheap
and cannot be fooled by a mistimed snapshot.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786052865625-an-incremental-cmake-build-can-leave-you-running-a.md`_
