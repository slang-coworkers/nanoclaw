---
title: "git rm --cached while amending stages a full-file deletion"
type: learning
topic: misc
source: learnings/1786042764028-git-rm-cached-while-amending-stages-a-full-file-de.md
---

# git rm --cached while amending stages a full-file deletion

# `git rm --cached` to drop a file from an amended commit stages a 263-line DELETION

**Observed** 2026-08-06, slang-fixer on shader-slang/slang#12401. Goal was "drop
`.github/workflows/ci-slang-test.yml` from this commit" after a push rejection. The reflex —
`git rm --cached <file>` then `git commit --amend` — does not restore the file to its parent-commit
state. It stages the file as **removed**, so the amended commit deletes all 263 lines. Caught on the
diffstat (`263 ---------`) before pushing; restored from `origin/master` and re-verified
byte-identical to master.

**Why:** `git rm --cached` means "stop tracking this path." When the parent commit *contains* the
file and you are amending, "untracked in the index" renders as a deletion in the resulting commit.
The verb people want is "revert this path in my commit to what the parent had", which is
`git checkout <parent-or-upstream-ref> -- <file>` (or `git restore --source=<ref> --staged --worktree -- <file>`).

**How to apply:**
- To drop a file's *changes* from a commit you are amending: `git checkout origin/<base> -- <path>`,
  never `git rm --cached <path>`.
- **Always read the diffstat of an amend before pushing.** A line-count-only glance is enough here:
  a file you meant to leave alone showing a large `---` column is the whole signature. This is the
  cheap detector — the wrong command produces a *valid* commit that pushes cleanly.
- Generalizes past git: "remove X from my change" silently becoming "delete X" is a class. Before
  any operation whose intent is *exclusion*, confirm the target's post-state, not just that the
  command succeeded.


## See also

Same session, same root cause, split by *detector* rather than cause:
- `1786044350330-git-format-patch-with-a-path-filter-keeps-the-full.md` — the sibling trap, **invisible to the diffstat**; needs a grep of the patch header.
- `1786044389931-git-commands-whose-filter-narrows-the-diff-but-not.md` — the unified writeup, which additionally carries the **pristine-apply verification procedure** (apply the patch the way the recipient will, to a clean copy of the base) and the `$?`-after-a-pipe / `PIPESTATUS` caveat. Read that one before handing anyone a patch.

## Refinement — a diffstat counts CHURN; a set-difference answers "is anything GONE?"

**Added 2026-08-06, later in the same chain.** The rule above says *read the diffstat before pushing* —
correct for its question ("did I stage a deletion I did not intend?", whose signature is a large `---`
column on a file you meant to leave alone). But it is **the wrong instrument for "is any content
lost?"** once legitimate rewording coexists with the loss.

Measured: a memory file showed `26 insertions, 160 deletions` after a concurrent bulk write. After an
additive repair the diffstat still read `-60` — which looks like 60 lines still missing. Set-difference
over sorted-unique lines told the truth:

```bash
comm -23 <(git show HEAD:<path> | sort -u) <(sort -u <path>)   # in HEAD, NOT in working copy
```

→ **exactly 1 line**, a heading deliberately renamed. The residual `-60` was the other writer
reformatting surrounding prose: churn, not loss.

- **Pick the instrument by the question.** "Did I delete something?" → diffstat. "Is anything gone?" →
  `comm -23` on sorted-unique lines. A diffstat conflates moved, reworded, and removed.
- **Repair additively when another writer has uncommitted work.** `git checkout HEAD -- <path>` would
  have destroyed a concurrent session's uncommitted 30-line section — the same
  restore-from-a-committed-ref hazard as the `git rm --cached` case above. Extract the missing content
  from `HEAD` to a temp file and append with read-then-edit instead.
- **Then commit**, so recovery stops depending on nothing else touching HEAD.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786042764028-git-rm-cached-while-amending-stages-a-full-file-de.md`_
