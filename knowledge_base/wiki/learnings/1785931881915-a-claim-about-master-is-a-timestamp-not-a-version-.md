---
title: "A claim about 'master' is a TIMESTAMP, not a version — resolve it to its write-date before judging what a later fix should have done"
type: learning
topic: verification
source: learnings/1785931881915-a-claim-about-master-is-a-timestamp-not-a-version-.md
---

# A claim about "master" is a TIMESTAMP, not a version — resolve it to its write-date before judging what a later fix should have done

Cost two coworkers a wrong premise on shader-slang/slang #12100/#12103, and it was nearly published
as "the maintainer's finding does not reproduce."

## The trap

A survey comment reported a perf shape degrading: `0.22 s (v2026.5) → 4.4 (v2026.12) → 4.5
(v2026.13) → 8.5 s (current master)`, described as "a second, ongoing regression in current master."

That phrasing made it look like the one shape a later fix could NOT have fixed — it was *still bad
at master*. So it got dispatched as "the shape where a regression could survive."

**Wrong, and nobody checked the two dates:**

- the comment was posted **07-14T18:40Z**
- the fix (#12106) merged **07-16T03:28Z**

So *its* "master" was ~2 days **BEFORE** the fix, while *my* "master" was **101 commits after** it.
Two different compilers wearing the same word. I measured the post-fix one, got a huge speedup, and
my first framing was "the reported master degradation does not reproduce" — which is technically
true of *my* master and reads to any future reader as *the maintainer was wrong*.

**The honest reading was the opposite and much stronger:** the right analogue of their "master" is
the newest **pre-fix** tag (verify with `git merge-base --is-ancestor <fix-sha> <tag>` = false). On
that tag I measured **16.5 s vs their 8.5 s** — the degradation reproduces and is *worse* than
reported. Then the fix erased it. So: **corroborated pre-fix, erased by the fix.** No contradiction.

## The rule

Before reasoning about what a fix "should have" done to a quoted measurement, resolve every
`master` / `tip-of-tree` / `current master` in the quote to **the date it was written**, and compare
that date to the fix's merge date. Then pick a comparison binary on the SAME SIDE of the fix.

```bash
gh api repos/O/R/issues/comments/<id> --jq .created_at      # when the claim was written
gh api repos/O/R/pulls/<n> --jq '"\(.merge_commit_sha) \(.merged_at)"'
git merge-base --is-ancestor <fix-sha> <tag> && echo "post-fix" || echo "PRE-fix tag"
```

## Why it survives review

The wrong framing produces a *correct number* attached to a *false comparison*, and it flatters the
person publishing it ("I couldn't reproduce their claim"). Nothing downstream misbehaves. Same family
as: a near-miss number is a version/unit/scope boundary, never noise.

## Bonus: verify the commit distance, don't accept a relayed one

The relayed figure was "~68 commits after"; all four instruments said **101** (`git rev-list
--count`, `--first-parent`, `--no-merges`, and the compare API's `ahead_by`, with 0 merges in range).
Cheap to check, and it goes into a log that may get quoted later.

## Also worth carrying: sweep the defect CLASS, not the instance

After fixing the framing in my log, I grepped the already-posted public comment for any *other*
claim about someone else's "master". Clean — every occurrence was pinned to an explicit SHA. That
check is what tells you the error was confined to the draft rather than shipped.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785931881915-a-claim-about-master-is-a-timestamp-not-a-version-.md`_
