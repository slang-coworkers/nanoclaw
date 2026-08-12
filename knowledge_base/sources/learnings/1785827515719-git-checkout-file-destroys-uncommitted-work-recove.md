# git checkout -- <file> destroys uncommitted work; recover from dangling objects, never retype

## What happened

I had an uncommitted fix in `slang-lower-to-ir.cpp` (119 insertions, already built and verified). To strip temporary `fprintf` debug traces I'd added to the same file, I ran:

```bash
git checkout source/slang/slang-lower-to-ir.cpp
```

That reverted the file to `HEAD` — removing the traces **and the entire uncommitted fix**. `git checkout -- <file>` does not distinguish "the lines I added five minutes ago" from "the lines I added an hour ago"; it discards all uncommitted changes to that path, with no confirmation and no reflog entry for the file contents.

## Recovery: look in the object store before retyping

The work was not necessarily gone. It had passed through `git stash` earlier in the session, and a popped stash leaves a **dangling commit**:

```bash
git fsck --no-reflog | grep "dangling commit"
# then, for each candidate:
git show <sha> --stat            # does it touch the right file?
git show <sha> | grep -q <a distinctive symbol from your work>
git checkout <sha> -- path/to/file
```

I found the dropped stash commit and confirmed it by shape (`119 insertions`, matching the pre-checkout `git diff --stat`) plus a distinctive symbol name, then restored from it.

**Why this matters beyond convenience:** the restored file is byte-identical to the code that produced my already-verified build and test results. Retyping from memory would have produced *similar* code whose verification no longer applied — I'd have had to re-run everything, and any transcription slip would be invisible. Recovering the exact object preserves the chain of evidence.

Other object-store recovery routes worth trying in order:
- `git stash list` — if the stash wasn't dropped yet.
- `git reflog` — for lost commits/branch tips (does **not** cover uncommitted file contents).
- `git fsck --no-reflog | grep -E "dangling (commit|blob)"` — popped stashes, orphaned index states. Dangling *blobs* can recover a single file's contents even when no commit references it.
- The compiled artifact (`.o`, binary) proves the work existed and can date it, but cannot reconstruct source.

## Prevention

- **Commit before you instrument.** Commit the real change (even as `wip:`), *then* add traces. Removing them becomes `git checkout` — now safe, because the fix is in history.
- **Or strip traces surgically:** delete just those lines with an editor, or `git diff > /tmp/save.patch` first.
- **Never use `git checkout -- <path>` / `git restore <path>` as a cleanup tool on a file holding uncommitted work you care about.** Same family as `reset --hard`: a blunt "make it match HEAD" instruction, applied to a file where you only wanted to undo part of your work.
- If you must, `git stash push -- <path>` instead — reversible, and recoverable via `fsck` even if dropped.

## Generalization

The reflex after "I destroyed something" should be **search the object store**, not **reconstruct from memory**. Git rarely deletes content immediately; it unlinks references. Reconstruction feels faster but silently invalidates every verification you'd already done against the original.
