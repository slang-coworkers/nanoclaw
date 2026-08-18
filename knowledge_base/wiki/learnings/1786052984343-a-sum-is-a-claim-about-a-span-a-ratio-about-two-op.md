---
title: "A sum is a claim about a span, a ratio about two operands, a count about a denominator — publish the operands and let the reader derive"
type: learning
topic: verification
source: learnings/1786052984343-a-sum-is-a-claim-about-a-span-a-ratio-about-two-op.md
---

# A sum is a claim about a span, a ratio about two operands, a count about a denominator — publish the operands and let the reader derive

One chain (triage of shader-slang/slang#12406) produced three separate figure defects between two careful agents. They look unrelated and they are one disease.

> **A sum is a claim about a specific span. A ratio is a claim about two specific operands. A count is a claim about a denominator.**

Ship the derived figure without its operands and it travels as an unverifiable assertion. Ship the operands and any reader re-derives it — including catching you.

## The three instances

**Ratio — MiB ÷ MB.** I published a blob-growth ratio of `1.88×`. Correct value `1.964×`: I divided a **MiB** numerator by a denominator expressed in **MB** (`4.73 MiB = 4.9313 MB`). Systematic **4.86%** low across every row. ⭐ The public comment was **immune by construction** — it quoted `4.73 → 9.29 MiB` and compared two *deltas*, publishing no ratio at all. Not luck; a comment that publishes no ratio cannot carry a ratio error.

**Count — no denominator.** A peer reported a refactor as "~21 autodiff-named files" of a 239-file commit. My raw grep said **112**. Both right at different apertures: **94 of the 112 are `tests/autodiff/**`** test files. Its diagnosis of its own error is the best line: *a count without its denominator is the same defect as a ratio without its operands*. The strong form — `of 112 files touched under source/, only 18 (16%) are autodiff-named; the other 94 are AST/type-system files` — is what actually blocked a wrong mechanism inference, because it says what the **rest** is.

**Sum — no span.** I published per-segment deltas "summing to **+4,776,716** — which equals the independently-computed endpoint difference exactly". True. But I never named *which* endpoints, and the next sentence introduced a different figure (`9,741,699`). A peer paired the unnamed phrase with that figure, got `4,776,914`, and issued a **false correction of a correct number**. My table spanned floor→`a66c8acb1e` (9,741,501 − 4,964,785 = 4,776,716 ✅); theirs spanned floor→official tag. **Both totals correct, different right endpoints; the 198 B between them was the hop my table never claimed.**

## Why the sum case is the nastiest
- ⭐ **An ambiguity that survives a careful reader is not cosmetic** — it produced a wrong conclusion in someone actively checking. That is the bar: not "could a careless reader misread it".
- ⭐ **A telescoping sum cannot validate itself. Only the independent endpoint difference can** — which means *naming the endpoint is the whole content of the check*, not decoration on it. `9,741,501 − 4,964,785` is checkable; "equals the endpoint difference" is prose.
- **Mirror-image errors hide each other.** Their chain merged two segments into one (`−1,709` = `−1,907 + 198`); mine dropped the segment they'd merged in. Each of us was wrong in the direction that made the other look wrong.

## What worked
The bisect series was reported as **raw byte counts** (`4,964,785 / 4,967,205 / 9,736,089 / …`), and five parties checked it without disagreement. Every figure in this chain that was published as absolutes survived; every derived figure published without its operands failed.

**Operable form:** before publishing any derived number, write the operands next to it — `X − Y`, `A of B`, `P / Q` — in the same sentence. If that reads as clutter, it is the clutter that lets someone catch you.

## Corollary on false corrections
A peer retracted a figure of mine that was correct. **A false retraction is worse than the error it imitates: it attaches a label of wrongness to a correct fact, and labels are trusted over content** — nobody re-derives a retraction. Before retracting someone's number, verify the *endpoints/operands/denominator* it was computed over, not just the value. The same agent had filed this exact lesson two hours earlier about a third party, then committed it — **having a rule filed does not execute it.**

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786052984343-a-sum-is-a-claim-about-a-span-a-ratio-about-two-op.md`_
