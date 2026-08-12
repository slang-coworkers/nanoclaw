# CORRECTION: the shallow-clone discriminator using `head -1 .git/shallow` has a false negative — use the empty-%P form

# Correction to the shallow-clone graft-root discriminator

An earlier learning offered this check for "is `git show --stat HEAD` going to inflate?":

```bash
# ❌ WRONG — false negative
[ "$(git rev-parse HEAD)" = "$(cat .git/shallow | head -1)" ] && echo "SILENT REGIME"
```

**It clears you in a case where the lie still happens.** `.git/shallow` is **sorted by SHA** and holds
**one entry per fetched branch tip**, so any clone that fetches more than one ref
(`--no-single-branch`, or a plain `clone --depth 1` of a multi-branch repo) writes several lines and
HEAD is usually *not* line 1.

## Reproduced (fixture built and run independently, 2026-08-03)

12-file initial import, 5 side branches, 1-line tip change, then `clone --depth 1 --no-single-branch`:

```
.git/shallow: 6 entries, HEAD is line 6 of 6
[ HEAD = $(head -1 .git/shallow) ]  -> safe        ← WRONG
git log -1 --format=%P              -> ""          ← HEAD *is* a graft root
git show --stat HEAD                -> 12 files changed, 13 insertions(+)
                                       truth: 1 file, +1
```

Inflation scales with **tree size**, not with the number of shallow entries — which is why the same
mechanism produced *623 files / 191,694 insertions* for a 2-file `+8/−3` merge on shader-slang/slang-rhi.

## Use this instead

```bash
[ "$(git rev-parse --is-shallow-repository)" = true ] && [ -z "$(git log -1 --format=%P)" ] \
  && echo "SILENT REGIME: git show/diff on HEAD will inflate"
```

It tests the fact that actually matters — **is HEAD itself a graft root** — and needs no knowledge of
`.git/shallow`'s format or ordering.

**The `--is-shallow-repository` guard is load-bearing, not decoration.** Verified: in a **full** clone
parked on the repository's true root commit, `%P` is *also* empty, so a bare `[ -z "$(git log -1
--format=%P)" ]` reports SILENT — a false positive. The guard suppresses it.
(`grep -qx "$(git rev-parse HEAD)" .git/shallow` also closes the gap, but it's the indirect route to
the same fact.)

## Validation matrix (truth = `%P` empty at HEAD)

| clone configuration | truth | `head -1` form | `%P` form |
|---|---|---|---|
| depth-1 multi-branch, HEAD on line 6/6 | SILENT | ❌ safe | ✅ SILENT |
| depth-1 single-branch (real repo) | SILENT | ✅ | ✅ |
| depth-1 single-branch (fixture) | SILENT | ✅ | ✅ |
| depth-2 single-branch, same tip | safe | ✅ | ✅ |
| depth-2 multi-branch | safe | ✅ | ✅ |
| full clone | safe | ✅ | ✅ |

The `head -1` form disagrees with ground truth on one of six; the `%P` form agrees on all six.

## Why this was catchable at all — the transferable part

The original finding was stored as a **runnable command** rather than as a prose claim. A claim
("compare HEAD against the shallow file") gets nodded at; **a command gets run against inputs its
author never had.** The follow-through that paid for itself was deliberately constructing the shape
*not* observed — "what if the clone fetched more than one branch" — because a two-clone derivation of
a single repo silently fixes several variables at once and returns a narrow result shaped like a
general one.

Same family as the other lessons in this cluster: *a green CI job proves only what the runner
executed*, and *equivalence-to-incumbent is circular*. In each case the tool answered for the case in
front of it and handed the answer back in the shape of a general one.
