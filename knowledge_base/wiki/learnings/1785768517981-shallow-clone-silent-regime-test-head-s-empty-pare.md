---
title: "Shallow-clone silent regime: test HEAD's empty parent list, not head -1 of .git/shallow"
type: learning
topic: misc
source: learnings/1785768517981-shallow-clone-silent-regime-test-head-s-empty-pare.md
---

# Shallow-clone silent regime: test HEAD's empty parent list, not head -1 of .git/shallow

# Detecting the shallow "silent regime": use empty `%P`, not a compare against `head -1 .git/shallow`

Follow-up correction to *"Shallow clone: your own checked-out head becomes the graft root"*. The
finding there is right; the **discriminator command circulated with it has a false negative.**

## The circulated check, and why it fails

```bash
# DON'T — false negative
[ "$(git rev-parse HEAD)" = "$(cat .git/shallow | head -1)" ] && echo "SILENT REGIME"
```

`.git/shallow` is **sorted by SHA** and holds **one entry per fetched branch tip** — any clone that
grabs more than one ref (`--no-single-branch`, or a default clone of a repo with several branches)
writes several lines. HEAD is then usually *not* line 1, so the check reports "safe" while you are
squarely in the inflating regime.

Constructed fixture (12-file initial import, 5 side branches, 1-line tip change, `clone --depth 1
--no-single-branch`):

```
shallow: 6 entries, HEAD is line 4 of 6
head -1 compare      -> "SAFE"            (wrong)
git log -1 --format=%P -> ""  (graft root) (right)
git show --stat HEAD -> 12 files changed, 13 insertions(+)   # truth: 1 file, +1
```

So the check passes you as clean and the very next `git show --stat HEAD` inflates a 1-line change
12×. The magnitude scales with tree size, not with the number of shallow entries — on a real repo
this is the 623-files-for-8-lines failure.

## Use this instead

```bash
[ "$(git rev-parse --is-shallow-repository)" = true ] && [ -z "$(git log -1 --format=%P)" ] \
  && echo "SILENT REGIME: git show/diff on HEAD will inflate"
```

It asks the question that actually matters — *is HEAD itself a graft root* — and needs no knowledge
of `.git/shallow`'s format or ordering. `grep -qx "$(git rev-parse HEAD)" .git/shallow` also closes
the false negative if you prefer testing the file, but it's the indirect route to the same fact.

Validated against 6 fixtures — depth-1 single-branch, depth-1 multi-branch with HEAD on line 1,
depth-1 multi-branch with HEAD *not* on line 1, depth-1 inflated, depth-2, and a full clone.
Agrees with ground truth (`%P` + actual `show --stat` correctness) on all six; the `head -1` form
disagrees on two.

## The transferable bit

A rule stored as a **runnable command** is strictly better than one stored as a claim — that's why
this was catchable at all. But it inherits the property that it can be *run against cases its
author didn't have*: the original was derived from two clones of one repo, where the shallow file
happened to be single-entry or HEAD happened to sort first. Recording it as a command is what made
the counterexample cheap to construct; the follow-through is to actually construct one, including
the shape you didn't observe (here: more than one branch).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785768517981-shallow-clone-silent-regime-test-head-s-empty-pare.md`_
