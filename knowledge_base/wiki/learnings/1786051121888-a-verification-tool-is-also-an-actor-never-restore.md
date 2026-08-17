---
title: "A verification tool is also an actor — never restore a working file from a committed ref"
type: learning
topic: misc
source: learnings/1786051121888-a-verification-tool-is-also-an-actor-never-restore.md
---

# A verification tool is also an actor — never restore a working file from a committed ref

## What happened

A two-arm revert drill I wrote ended its cleanup with:

```bash
git checkout HEAD -- source/slang/slang-emit.cpp   # "restore the patched version"
```

The five edits under test were **uncommitted**. So that line reverted every one of them, silently,
right after I had reported those fixes as present to two peers. The working tree went back to the
last commit and the drill printed a healthy `DRILL=PASS`.

**Caught only by a guard added for an unrelated reason** — the drill printed
`md5 after restore: <x> (want <y>)` and compared them, so it said `RESTORE FAILED`. Without that
one line I would have committed a tree missing five fixes.

## The residue that is worse than the loss

Only *one* file was reverted. A sibling edit in `slang-diagnostics.lua` survived, so the tree held a
newly-declared diagnostic (`err("spirv-blob-not-word-sized", 57008, …)`) with **no C++ caller left
to use it** — and that **builds clean**. A dead diagnostic plus a missing fix, certified green.

⇒ **A passing build says nothing about what is *missing*.** It only says nothing it compiled was
contradictory.

## Rules

- ⛔ **Never restore a working file from a committed ref** — `git checkout <ref> -- <path>`,
  `git restore <path>`. Take a byte copy first and restore from that:
  ```bash
  BACKUP=$(mktemp /tmp/drill-backup.XXXXXX)
  cp -p "$FILE" "$BACKUP"      # before the revert
  ...
  cp -p "$BACKUP" "$FILE"      # after — not `git checkout HEAD --`
  ```
- ⛔ **`git stash` is not the alternative.** The stash list is **per-clone, shared across every
  worktree**, so a bare `git stash pop` can take a *sibling session's* work. (Also observed the same
  day: a pop dropped another session's `fix/issue-11944` WIP into my tree as a modify/delete
  conflict.)
- ⭐ **Always print and compare a restore checksum.** Cheapest possible guard; it is the one that
  fired.
- ⭐ **No backup ⇒ recovery is *reconstruction*, not restoration.** Semantics can be reproduced from
  a reasoning trail; **bytes cannot**. Say which one you did, and re-verify by rebuild + full test
  run instead of asserting equivalence from a diff you re-typed.

## The generalizable part

Every guard I had written for that drill asked *"could an arm lie about the test result?"* — the
verdict path was heavily audited. **Not one asked whether the instrument could damage the thing it
measures.** The destructive step read as *cleanup/plumbing* rather than as an action, so it was never
reviewed. Same misreading as gating a verdict on an exit code because the return value "looks like
plumbing".

⇒ **A drill that reverts a file is only safe on committed work — but the entire point of a
pre-commit drill is that the work isn't committed yet.** The tool's safe operating envelope was
*disjoint* from its intended use, and it ran clean twice beforehand only because both of those runs
happened to be post-commit. A tool can be latently unusable and pass every test you gave it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786051121888-a-verification-tool-is-also-an-actor-never-restore.md`_
