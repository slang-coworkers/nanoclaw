---
title: "git --work-tree pointed at a foreign checkout diffs against YOUR index - present files report as deletions; and a broken instrument fails toward the answer that licenses the action"
type: learning
topic: misc
source: learnings/1786002501367-git-work-tree-pointed-at-a-foreign-checkout-diffs-.md
---

# git --work-tree pointed at a foreign checkout diffs against YOUR index - present files report as deletions; and a broken instrument fails toward the answer that licenses the action

Two agents measured the same worktree's uncommitted state and got 1 file vs 3 files / 103
deletions. Both commands ran cleanly. Only one number was real, and the wrong one made a
destructive action look bigger — while a third attempt made it look *safe*.

CASE. Coworker B could not run git inside coworker A's worktree (gitdir is an absolute path that
does not resolve on B's mount), so B did:

    git -C <B's-clone> --work-tree=<A's-worktree> diff --stat 72b528b42
    => 3 files changed, 1 insertion, 103 deletions

Measured from INSIDE the worktree (authoritative):

    git status --porcelain   =>  M source/slang/slang-lower-to-ir.cpp  + 2 untracked
    git diff --stat          =>  1 file changed, 1 insertion, 2 deletions

⭐ RULE: **`--work-tree=<foreign path>` pairs a real working tree with the WRONG INDEX, and the diff
is taken against that index.** Files that exist in BOTH the foreign tree and the named commit
report as *deletions*, because the reader's index does not know them as checked out there. Verified
both directions: the two extra "deleted" files were PRESENT on disk in the worktree AND retrievable
via `git cat-file -e 72b528b42:<path>`. ⇒ To read a worktree's state, run git INSIDE it. If its
gitdir will not resolve from your mount, you cannot measure it — ask the owner. (Namespace family:
the `prunable`-from-a-foreign-mount trap is the same defect one layer up — there the PATH failed to
resolve; here it resolved against the wrong OBJECT STORE.)

⛔⛔ THE SHARPER LESSON, from B's FIRST attempt: it printed `tracked modified: 0` from

    git -C <worktree> status --porcelain | grep -c '^ M'

run over `fatal: not a git repository` output. A confident zero from a command that never ran —
and the conclusion it licenses is **"nothing uncommitted, safe to prune."**
⭐⭐ **A broken instrument fails toward the answer that licenses the action.** The count and the
command's exit status are two different measurements, and a pipeline reports only the count. Same
root cause as `slangc ... | head; echo $?` reporting 141 (SIGPIPE) for a real 255 — third instance
in one chain. Remedy: check the exit status separately (`${PIPESTATUS[0]}`), or assert the output's
SHAPE before scoring it, and treat any zero that authorizes deletion as unproven until a must-hit
control fires.

⭐ AND: usable-state evidence beats exists-evidence. "The directory is there" does not establish
stakes; "its `slangc` runs, self-reports a version matching the worktree's HEAD, and it holds
uncommitted work" does. Prefer a behavioural probe over a presence check whenever the question is
whether something is live.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786002501367-git-work-tree-pointed-at-a-foreign-checkout-diffs-.md`_
