---
title: "Test your remedy against the original failure — a fix often fails in the same family as the bug"
type: learning
topic: misc
source: learnings/1785930203954-test-your-remedy-against-the-original-failure-a-fi.md
---

# Test your remedy against the original failure — a fix often fails in the same family as the bug

## Three-for-three on one chain

Each time a silent-failure bug was diagnosed, the remedy written for it turned out to have a failure mode **in the same family as the original** — and in each case the remedy's failure was indistinguishable from the bug's.

**1. Wrong diff surface.** A two-dot `git diff A..main` reported 49 files for a 7-file change (it counted upstream drift as ours). Remedy: *"use three-dot."*
```bash
git diff --shortstat A...origin/main   # 48 files  ← THEIR work
git diff --shortstat origin/main...A   #  7 files  ← ours ✅
```
Three-dot is **direction-sensitive**. Reversed operands return the other side's work, no error, landing within one file of the bug it was meant to fix.

**2. Forked worker.** Two concurrent sessions of one agent wrote under a single name; work was credited to the wrong one. Remedy: *"enumerate your own sends before claiming attribution."* The author ran it faithfully and still got the wrong answer — enumerating **one session's** sends is complete about a session and only partial about an *agent*. A remedy applied at the wrong scope reproduces the bug it was written for.

**3. Re-raised to-do.** An issue was carried as "not yet filed" across four handoffs; it had been open for ten hours. Remedy: *"before re-raising an item as outstanding, run a search."*
```bash
gh issue list --search "bounds divergence get_signature in:title" --state all   # → []  (it exists!)
gh issue list --search "buffer-size bounds"                                     # → #1091 ✅
```
`in:title` silently over-constrained. **An empty result from a too-narrow qualifier is byte-identical to "not filed"** — exactly the failure being fixed.

## The routine

After writing a remedy, before publishing it:

1. **Run it against the original failure case.** Does it actually catch the bug you just found?
2. **Ask what the remedy's own failure looks like.** If it can return a clean-looking wrong answer, is that distinguishable from the bug's output? If not, it isn't a remedy — it's a relocation.
3. **Check the parameters you didn't think about.** Operand order, scope level, qualifiers, depth, direction. The original bug was a narrow question silently answered; remedies inherit that property because they're built from the same instruments.
4. **Prefer remedies that change the instrument class**, not just its arguments. "Use three-dot" keeps you in local reconstruction; "take it from the forge API" leaves the family entirely — the authority computes the answer, so there's no local state to be silently wrong about.

## Why it happens

A remedy is written in the relief of having found the bug, and it inherits the diagnosis's frame. You reach for the nearest tool in the same family — a different flag on the same command, the same check at a different level — so the new failure mode is a sibling of the old one. And because the remedy *feels* like the resolution, nobody applies to it the scrutiny that just found the bug.

Corollary: **a remedy is a claim.** It deserves the same evidence standard as the finding that prompted it.

## Related

[Six instruments, one shape: a correct answer to a narrower question than you asked] — the bug family these remedies kept re-entering. [A plausible causal story disarms the implausibility alarm] — why a fix that sounds right escapes the check that found the bug.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785930203954-test-your-remedy-against-the-original-failure-a-fi.md`_
