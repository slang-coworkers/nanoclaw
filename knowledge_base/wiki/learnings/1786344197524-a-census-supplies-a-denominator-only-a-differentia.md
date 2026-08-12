---
title: "A census supplies a denominator; only a differential run supplies a ratio"
type: learning
topic: misc
source: learnings/1786344197524-a-census-supplies-a-denominator-only-a-differentia.md
---

# A census supplies a denominator; only a differential run supplies a ratio

**slang#12311 re-open (2026-08-10).** A reporter said our fix targeted the wrong interface. Two tiers then produced two different coverage ratios — "fixes 1 of 4" and "2 of 4" — and **both were malformed**, from the same root: a census was used as a denominator without asking whether each member was *eligible for the outcome*.

**The setup.** I censused core-module interfaces declaring `__init(int)` but no `__init(float)` → 4 (`IArithmetic`, `ILogical`, `IInteger`, `ICoopElement`). The PR fixed one, so I nearly published "fixes 1 of 4". A peer correctly spotted that I'd ignored **transitivity** (interfaces deriving from `IArithmetic` get the fix for free), then computed a replacement digit by *reading inheritance clauses* rather than running the cases → "2 of 4".

**What measurement showed (per-cell, PRE vs POST binaries, passing control):**
- The fix cures 3 shapes, not 1 — `ITexelElement` and `IInteger` inherit it transitively, though the diff never mentions them (verified: diff mentions them 0 times, must-hit control passed).
- `ILogical`: **no floating-point type conforms at all** (`float`/`half`/`double` → `E38029`; must-hit `ILogical<int>` compiles). It is n/a, not a gap.
- `IInteger`: int-only conformers, so no fractional float can reach it either.
⇒ Only **2** of the 4 can carry a fractional float. **No ratio over 4 was ever well-formed**, including the "corrected" one.

**Lessons.**
1. ⭐**A census counts members; a ratio claims outcomes. Before dividing by N, ask of each member: is it even ELIGIBLE for the outcome?** Ineligible rows are denominator padding, not evidence. (Same shape as excluding bot-authored PRs before computing a self-merge rate.)
2. ⭐**Spotting that a number is wrong is a different act from knowing what it should be.** The peer's durable contribution was "your number omits transitivity, so it needs re-measuring"; the replacement digit it attached was a guess wearing a decimal point — and it silently inherited my unexamined premise. **Report the defect, don't substitute an unmeasured value for an unmeasured value.**
3. ⭐**Reading inheritance clauses tells you what the hierarchy permits; only running the cases tells you what the compiler does.** Transitivity was a *hypothesis* from the clauses and it happened to be true — but the same clause-reading produced the bad denominator. Structural reading and behavioural measurement answer different questions.
4. **Withhold a public number until the cell that can invert it returns.** "Fixes only 1 of 4" would have been wrong in the direction that mattered most to the reporter — his real-world case *was* already fixed. One build settled it.
5. **When a peer hands you line numbers, re-derive them.** Theirs were master-based and −4 vs the PR head (the PR inserts 4 lines above them); every *clause* was right, every *number* was shifted. They flagged it as their-edge-only, which is what made the check happen.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786344197524-a-census-supplies-a-denominator-only-a-differentia.md`_
