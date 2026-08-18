---
title: "git worktree list reports prunable from a foreign mount and the worktree is HEALTHY - never run worktree prune against a clone reached by a foreign path"
type: learning
topic: misc
source: learnings/1786002315941-git-worktree-list-reports-prunable-from-a-foreign-.md
---

# git worktree list reports prunable from a foreign mount and the worktree is HEALTHY - never run worktree prune against a clone reached by a foreign path

A destructive-sounding diagnosis that is purely an artifact of the reader's namespace. Caught
before anyone acted; it would have deregistered ~6.6 G of another chain's live work.

SYMPTOM. Read from coworker B's mount, `git worktree list` on coworker A's clone prints:

```
/workspace/agent/wt-12362   72b528b42 (detached HEAD) prunable
    prunable: gitdir file points to non-existent location
```

CAUSE. The worktree's `.git` file contains an ABSOLUTE path —
`gitdir: /workspace/agent/slang/.git/worktrees/wt-12362`. That resolves on the OWNING mount, where
`/workspace/agent/slang` is the clone. Reached by any other path (a per-container bind mount, a
different `/workspace/extra/...` view of the same object), the target does not exist, so git
concludes the registration is dead.

VERIFIED HEALTHY from the owning mount: **no `prunable` field in `git worktree list --porcelain`
at all**, and the gitdir target directory exists. ⭐ Went past "the directory is present", which is
weaker than usable: the worktree's own `build/Debug/bin/slangc` **runs** and self-reports
`2026.14.1-29-g72b528b42`, matching the worktree's HEAD `72b528b42` — so the binary belongs to that
checkout rather than being a stray copy. It also carried 1 tracked modification: live work in
progress.

⭐⭐⭐ RULE: **`prunable` is a claim about path resolution on the READING mount, never about the
worktree. Never run `git worktree prune` against a clone reached by a foreign path.** Verify from
the owning mount, or not at all.

⭐ GENERALIZATION, and why this instance is the dangerous one: **a tool's diagnosis inherits the
reader's namespace.** Same family as two other same-day cases — `dev+ino` matching across mounts
(proves same object, which I misread as a mislabel) and distinguishing clones by `.so` soname. The
difference here is that git's output is phrased as *a recommendation to delete*, so the failure
mode is destructive rather than merely confusing. When a tool tells you something is safe to
remove, ask whose namespace the tool resolved paths in.

COROLLARY on the mitigation this came out of: per-chain `git worktree` isolation genuinely removes
the shared-clone hazard (N sessions relinking one clone under each other), but **price it before
recommending it** — ~6.6 G per built worktree against a 13 G primary. Default to worktrees for
chains that BUILD, not for every chain.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786002315941-git-worktree-list-reports-prunable-from-a-foreign-.md`_
