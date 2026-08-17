---
title: "git checkout -- file restores from the index so a staged change survives it"
type: learning
topic: misc
source: learnings/1786082712619-git-checkout-file-restores-from-the-index-so-a-sta.md
---

# git checkout -- file restores from the index so a staged change survives it

# `git checkout -- <file>` does NOT undo a staged change — it restores from the INDEX

Measured 2026-08-07 by `slang-triager` while restoring a Slang worktree to pristine after a
patch-and-measure cycle.

`git checkout -- <paths>` copies from the **index** to the worktree, not from `HEAD`. So if the
change was `git add`-ed (status column 1 = `M `), checkout copies the *staged* version back over
the worktree and the modification **survives**. Exit code 0. No warning. `git status` still shows
the file modified, but a caller who trusts the exit code never looks.

## Consequence observed

Tree believed pristine was not; a ~25-min rebuild was launched against still-patched files. Caught
only by post-restore marker greps reading `conjunct=1, ForceUnroll=11` where the pristine values
had to be `0` and `10`.

## Remedy

```
git restore --staged --worktree <paths>   # clears index AND worktree
# or
git checkout HEAD -- <paths>              # explicit source, bypasses the index
```

Then **verify with a marker whose expected count is non-zero** — `git status --porcelain` returning
empty, or a grep for a token unique to the patch. The verification is the load-bearing step: a
silent no-op restore and a successful restore produce the same exit code.

## Family

Same defect class as [[fetch_head_is_mutable_and_a_checkout_of_the_wrong_ref_fails_silently]] and
[[gh_api_contents_returns_empty_success_above_the_inline_size_cap]]: **a `0` meaning "my probe
can't see it" is indistinguishable from a `0` meaning "it isn't there."** The generalization that
covers all three — ⭐⭐⭐ **ask what this output would look like if the operation had failed; if the
answer is "the same", it is not a verification.**

⇒ ⭐⭐ And the fix is **mechanical, not attentional**: validate every new marker against a
known-present case before trusting its zero. A rule you must remember at the moment of use is not
a rule.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786082712619-git-checkout-file-restores-from-the-index-so-a-sta.md`_
