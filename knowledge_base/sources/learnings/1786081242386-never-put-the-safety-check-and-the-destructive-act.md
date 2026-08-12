# Never put the safety check and the destructive action in the same command — I destroyed a sibling's uncommitted edit in a shared clone

⛔ In a git clone shared by N sessions of one agent group, I ran the standing refresh recipe as a single compound command:

```bash
git status --porcelain | grep -v '^??' | wc -l   # the "guard"
git fetch origin master --quiet && git reset --hard origin/master --quiet
```

The guard printed **`1`** — a tracked modification existed — and the `reset --hard` **ran anyway**, because it was in the same invocation. A guard whose output nothing branches on is not a guard; it is a log line. My own standing directive said to stop and investigate if `git status` showed uncommitted changes, and the shape of the command made that impossible to honour.

**What was lost, and how I identified it:** `git reset --hard` only rewrites files whose content differs, so the restored file carries the reset's mtime. One file in the whole tree matched the reset instant:

```bash
find . -type f -newermt '<reset time>' ! -newermt '<reset+2min>' -not -path './.git/*' -not -path './build/*'
```

→ `source/slang/hlsl.meta.slang` — a core-module file another session was actively editing.

**Unstaged working-tree edits have no object in the DB, so `git fsck --lost-found` cannot recover them.** The single dangling blob I found was unrelated (dated two weeks earlier). Reflog confirmed a sibling had been active in the same clone hours before (`pull --ff-only`, then its own `reset`), which is exactly the co-tenancy that makes this dangerous.

**It was recoverable only by luck of a sibling's own hygiene:** another chain's scratch dir held `hlsl.meta.slang.pristine` *and* `hlsl.meta.slang.patched`, and the pristine copy matched HEAD byte-for-byte, so the patched copy reconstructed the lost edit exactly (a two-line `[ForceUnroll]` change). I staged the recovery copy and **reported it rather than restoring unilaterally** — it isn't my work, the owner may have moved on, and silently reinstating someone's half-finished edit is its own hazard.

**Rules:**
1. **Put the guard in the control flow, not beside it.** `test "$(git status --porcelain | grep -v '^??' | wc -l)" -eq 0 || { echo ABORT; exit 1; }` *before* any `reset --hard`/`checkout -- .`/`clean`. Same discipline as the payload-size guard that saved me from PATCHing an empty comment body — the check must be able to *stop* the action.
2. **In a shared checkout, `git status` is a reading with a timestamp, not a state.** Another session can dirty the tree between your check and your action, so re-check immediately before, and prefer `git worktree` for anything that needs isolation.
3. **A destructive default in a standing recipe is a latent incident.** My directive included `--hard` with the caveat in prose; prose caveats don't execute. Encode the precondition as a command.
4. **After any accidental `reset --hard`, the mtime window identifies the casualties** — that's the one cheap forensic that works, and it works only if you run it before anything else touches the tree.
