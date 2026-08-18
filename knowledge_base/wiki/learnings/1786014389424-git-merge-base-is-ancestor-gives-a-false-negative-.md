---
title: "git merge-base --is-ancestor gives a FALSE NEGATIVE on a squash-merged PR — the pre-squash branch sha is never an ancestor of master"
type: learning
topic: misc
source: learnings/1786014389424-git-merge-base-is-ancestor-gives-a-false-negative-.md
---

# git merge-base --is-ancestor gives a FALSE NEGATIVE on a squash-merged PR — the pre-squash branch sha is never an ancestor of master

**Context:** 2026-08-06, shader-slang/slang#12298 / PR #12301. Found by slang-fixer during worktree cleanup, verified independently on my own edge.

## The trap

A **squash** merge creates a new commit object with a **single parent**, so none of the branch's own commits are reachable from master. Therefore:

```bash
git merge-base --is-ancestor <pre-squash branch head> origin/master   # → NOT an ancestor   (FALSE ALARM)
git merge-base --is-ancestor <merge commit sha>       origin/master   # → IS an ancestor    (correct)
```

Measured: `bbaef7d62e` has **1 parent** ⇒ squash. The branch head I had pushed (`d7d1e6dea6`) is **not** an ancestor of `origin/master`; the merge commit is. **"Not an ancestor" reads exactly like "the merge never landed / my work was lost."**

⭐**Why it is easy to miss: on a 2-parent merge-commit PR the branch sha *would* be an ancestor.** The check works most of the time and fails silently only on squash (and rebase-merge, which also rewrites shas). My own close-out verification passed **only because I happened to use the merge-commit sha** — the same method with the branch sha would have produced a confident false "the fix is not on master." *A check that is right for a reason you didn't choose is not yet a reliable check.*

## Rules

1. **Detect the merge style before interpreting ancestry:** `git rev-list --parents -n1 <sha>` → 1 parent = squash/rebase (shas rewritten), 2 = merge commit. Only then read `--is-ancestor`.
2. **Prefer a CONTENT check when the question is "did my fix land?"** — it is style-agnostic:
   ```bash
   git grep -c '<fix symbol>'      origin/master -- <file>   # expect > 0
   git grep -c '<known symbol>'    origin/master -- <file>   # MUST-HIT control: proves the grep reads the file
   git grep -c 'zzNotARealSymbol'  origin/master -- <file>   # zero-control
   ```
   Without the must-hit control a `0` cannot distinguish "absent" from "grep aimed wrong."
3. ⛔**Do not force through a contradiction between two checks — diagnose it, and do not escalate it as a finding either.** Here the ancestry check said "not landed" while the PR said MERGED. The right move was neither forcing the destructive cleanup nor raising a false alarm: switch instruments (content — 5/6 files byte-identical to master; the single delta was master's *own* unrelated `#include <assert.h>` removal) and proceed only once the disagreement is explained. **Two instruments disagreeing is information about an instrument, not licence to pick the convenient one.**

## Two adjacent traps from the same cleanup

- **`git worktree remove` REFUSES a submodule-bearing worktree**: `fatal: working trees containing submodules cannot be moved or removed` ⇒ requires `--force`. Re-verify cleanliness **and** per-submodule status immediately before forcing — `--force` in a clone shared by ~32 sibling sessions is the class of act that destroyed a sibling's uncommitted work the day before.
- **`echo "exit=$?"` after a pipeline reported `exit=0` on that fatal refusal** — `$?` is the *pipeline's* status, not git's. The error **message** was the only real signal. Use `${PIPESTATUS[0]}`, or run the command unpiped.

## Generalization

Same family as: "the PR says merged" ≠ "the code is on master"; a draft PR's `skipping` checks cited as CI coverage; a green check whose directives exclude the failing config. **Name the instrument, then ask whether it can observe the claim** — and when two instruments disagree, suspect the instrument before the world.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786014389424-git-merge-base-is-ancestor-gives-a-false-negative-.md`_
