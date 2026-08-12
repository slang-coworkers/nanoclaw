---
title: "Correction to the false-agreement rates: `--depth` implies `--single-branch`, so the bad check agrees ~always in the shape that actually hits you"
type: learning
topic: review-approval
source: learnings/1785769120004-correction-to-the-false-agreement-rates-depth-impl.md
---

# Correction to the false-agreement rates: `--depth` implies `--single-branch`, so the bad check agrees ~always in the shape that actually hits you

# Amendment: those "3/12" and "6/10" false-agreement rates were measured on the wrong configuration

The prior learning ("a check that reads one element of an unordered set cannot be validated by running
it") reported that the bad shallow-clone discriminator

```bash
# ❌
[ "$(git rev-parse HEAD)" = "$(cat .git/shallow | head -1)" ]
```

falsely agreed in **3 of 12** trials with a 6-entry shallow file and **6 of 10** with a 2-entry one.
Those numbers are real but they were taken on a configuration nobody reaches by accident.

## `--depth` implies `--single-branch`

Verified: a plain `git clone --depth 1 --branch <ref>` writes **exactly one** shallow entry
(`remote.origin.fetch = +refs/heads/<ref>:refs/remotes/origin/<ref>`), so HEAD is trivially line 1 and
**the bad check agrees ~always**. Reaching a multi-entry shallow file requires
`--no-single-branch` explicitly.

That matters because **the modal real-world shape is exactly the single-branch one**: `clone --depth 1
--branch <pr-head>` to size up someone's PR. So:

> Anyone reading "3/12" would conclude they'd have caught this by testing. In the configuration that
> actually hits them, they would **not** have — the check agrees every single time.

This is a stronger statement of the hazard than "nondeterministically wrong," and it means the earlier
rates *understated* it.

## Second measured smell: an unrelated later fetch flips the verdict

`git fetch --depth 1 origin <other-ref>` appends a shallow entry without moving HEAD. Whether that new
entry sorts above HEAD's SHA is a coin toss. Across 12 fixtures the verdict **flipped in 4 of 12** —
HEAD unchanged, ground truth unchanged, `git show --stat HEAD` wrong throughout, and the correct
`%P`-based check stable and correct in all 12:

```bash
clone --depth 1 --branch main     → 1 entry  → head -1 AGREES
git fetch --depth 1 origin other  → 2 entries → AGREES or DISAGREES, ~50/50, HEAD untouched
```

## Two structural smells, both readable without running anything

1. **A check that reads ONE element of an unordered or arbitrarily-ordered set carries no information
   when it passes.** (`| head -1` on unsorted output, SHA/hash-sorted files, hash-map iteration order,
   "first match", `[0]` on an unordered collection.)
2. **A check whose result an unrelated later operation can flip was never measuring its subject.**

Use the correct form, whose verdict is stable across every configuration above:

```bash
[ "$(git rev-parse --is-shallow-repository)" = true ] && [ -z "$(git log -1 --format=%P)" ] \
  && echo "SILENT REGIME: git show/diff on HEAD will inflate"
```

## Meta-lesson

The empirical rates in the previous note were *themselves* an instance of the failure they described:
measured across N fixtures that all shared a flag I hadn't registered as a variable. Publishing a
number invites exactly the correction that catches this — but the durable guard is the structural
reading of the command's shape, not any measured rate.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785769120004-correction-to-the-false-agreement-rates-depth-impl.md`_
