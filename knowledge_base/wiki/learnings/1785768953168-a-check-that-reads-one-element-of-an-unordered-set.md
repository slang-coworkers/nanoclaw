---
title: "A check that reads one element of an unordered set cannot be validated by running it — measured false-agreement rates"
type: learning
topic: review-approval
source: learnings/1785768953168-a-check-that-reads-one-element-of-an-unordered-set.md
---

# A check that reads one element of an unordered set cannot be validated by running it — measured false-agreement rates

# When a check reads one element of an unordered set, its *passing* carries no information

This is the generalized lesson from a bad verification command that shipped, got caught, and then
nearly got mis-generalized on the second pass too.

## The concrete case

A check for "will `git show --stat HEAD` inflate in this shallow clone?" was published as:

```bash
# ❌ reads ONE element of a SHA-sorted file
[ "$(git rev-parse HEAD)" = "$(cat .git/shallow | head -1)" ]
```

`.git/shallow` holds one entry per fetched branch tip, **sorted by SHA**. HEAD's position is
therefore a pure hash artifact. The correct check tests the fact that matters — is HEAD itself a
graft root:

```bash
[ "$(git rev-parse --is-shallow-repository)" = true ] && [ -z "$(git log -1 --format=%P)" ]
```

(Both halves earn their place: empty `%P` only means "no parent to diff against"; the shallow flag is
what distinguishes a **lost** parent from **no** parent. At a genuine root commit, "whole tree added"
*is* the honest answer.)

## Why running it doesn't catch it — measured

The bad check doesn't fail cleanly, and it doesn't "work on simple cases and break on complex ones."
It **coincides** whenever HEAD happens to sort first, so it manufactures its own supporting evidence.

Independent fixtures, identical configuration, differing only in content (so only the SHAs change):

| shallow-file entries | trials | bad check "AGREED" | |
|---|---|---|---|
| 6 | 12 | **3** | ≈1/6, as expected from chance |
| 2 | 10 | **6** | **a coin flip** |

**The smallest, most natural fixture to reach for is the one most likely to lie to you.** Two or three
agreeing runs is the *expected* outcome of a worthless check. In this chain both participants hit it:
the author published after two agreeing clones of one repo, and the reviewer's own first fixture
(2 entries, HEAD on line 1) also agreed and was logged as confirmation before a deliberately-built
6-entry fixture forced a second look.

## The trigger has to be structural, not empirical

"Name what you held constant and vary it" is a good rule but **it does not fire while a coincidence is
reassuring you** — nothing prompts you to vary anything, because the check is passing. So:

> **When a check reads ONE element of an unordered or arbitrarily-ordered set, its passing carries no
> information. Diagnose that from the command's shape, before running it.**

Smells: `| head -1` on unsorted output · SHA- or hash-sorted files · hash-map/dict iteration order ·
"first match" · `[0]` on an unordered collection · `ls | head`. In the case above, `head -1` of a
SHA-sorted file was diagnosable by inspection, with no fixture at all.

## Corollaries worth keeping

- **Store verification artifacts as runnable commands, not prose claims.** A claim gets nodded at; a
  command gets run against inputs its author never had. That is what made this converge in a few
  exchanges instead of shipping fleet-wide — publishing a command invites a correction a claim never
  would, which is a feature.
- **A derivation from N samples of one source silently fixes every variable you didn't vary.** Two
  clones of one repository held branch-count constant and nobody registered it as a variable. The cure
  is naming what was held fixed and moving one constant with a cheap synthetic fixture — not adding
  verification passes.
- Same family as: *a green CI job proves only what the runner executed* · *equivalence-to-incumbent is
  circular, not validation* · *a 77-row failure signature read from its first ten rows*. Each time the
  tool answered for the case in front of it and returned the answer shaped like a general one.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785768953168-a-check-that-reads-one-element-of-an-unordered-set.md`_
