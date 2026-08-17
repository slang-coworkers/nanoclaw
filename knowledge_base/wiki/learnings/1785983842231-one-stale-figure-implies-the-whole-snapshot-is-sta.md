---
title: "One stale figure implies the whole snapshot is stale — and validate parts with a partition control"
type: learning
topic: misc
source: learnings/1785983842231-one-stale-figure-implies-the-whole-snapshot-is-sta.md
---

# One stale figure implies the whole snapshot is stale — and validate parts with a partition control

## What happened

Reporting slang#12367 I published **three** wrong figures, all from one measurement taken before
commits that mutated what it measured (two commits removed comment lines):

| figure | published | true |
|---|---|---|
| total insertions | +421 | **+419** |
| `slang-ir-check-unsupported-inst.cpp` | +142 | **+140** |
| "the PR body's stat line" | referred to as existing | **the body has no line count at all** |

The first surfaced only because a routine final `git status`/`--shortstat` printed a number that
disagreed with what I had already sent. **Two of your own counts for one artifact disagreeing is
the cheapest check available** — it caught what four codex critique rounds and several targeted
sweeps did not, because none of them was looking at the arithmetic.

## Rule 1 — patch the batch, not the instance

I stated the right rule ("a measurement taken before an action that mutates its referent is wrong
when published") and then fixed **only the total**, because that was the figure the disagreement
exposed. The per-file number from the same snapshot was equally stale and went out to two
recipients.

⇒ **One stale figure from a snapshot implies EVERY figure from that snapshot is stale.** When you
find one, re-derive all of them, and enumerate which artifacts carry them. This is the
fix-one-position/miss-the-class error applied to your own arithmetic — knowing the pattern does not
fire it.

## Rule 2 — a partition control validates the parts; the total validates nothing about them

Re-checking the **total** cannot detect a wrong **part**. The control that can:

```bash
# per-file additions must sum to the PR-level total, over the expected file count
git diff --numstat <base>..HEAD -- source/ tests/ | awk '{s+=$1} END {print s}'
git diff --shortstat <base>..HEAD -- source/ tests/       # must agree, same file count
```

Mine closes exactly (419 = 419 across 10 files), which would have flagged any per-file figure that
disagreed. My reviewer had `140+ 0-` on screen in an earlier per-file read and did not compare it,
because he was checking the total — the disconfirming datum was already in hand.

## Rule 3 — "did it reach the public?" has more than one referent

My reviewer concluded the drift never reached GitHub by checking the one artifact he held (his issue
comment). But the **PR body is also public**. The conclusion happened to hold — verified with a
control: `insertion|41[0-9]|42[0-9]|14[02]|deletion` all 0, non-zero control `E55216` = 2 — but for
a reason neither of us had checked, and meanwhile I had asserted a "stat line" in the body that
never existed.

⇒ Before claiming something did or did not reach a public surface, **enumerate the surfaces the
claim covers** rather than testing the one you happen to be holding. Same wrong-population defect as
grepping one directory level for a transitive question.

## Bonus: audit credit as hard as blame

A chain-closing summary credited my "review discipline" with producing five defects. Two were the
critique tool's, not mine — including one where my own reasoning had been backwards. I declined the
attribution. **Credit-facing claims in a wrap-up get the least scrutiny from both sides** — the
author because it feels like recapping, the recipient because it flatters and they have no incentive
to refuse. Restate what actually happened; here it was verification-before-action (which is why two
*incorrect* findings were rejected rather than shipped), not detection.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785983842231-one-stale-figure-implies-the-whole-snapshot-is-sta.md`_
