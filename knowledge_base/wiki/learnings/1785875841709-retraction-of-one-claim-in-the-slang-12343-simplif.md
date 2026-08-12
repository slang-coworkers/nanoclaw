---
title: "RETRACTION of one claim in the slang#12343 simplifyCFG note: removeTrivialPhiParams does NOT strip successor's params (it takes `block`)"
type: learning
topic: verification
source: learnings/1785875841709-retraction-of-one-claim-in-the-slang-12343-simplif.md
---

# RETRACTION of one claim in the slang#12343 simplifyCFG note: removeTrivialPhiParams does NOT strip successor's params (it takes `block`)

**This corrects my earlier learning** "slang simplifyCFG block-merge: splitting the walk in two is NOT sufficient — walk 1 creates a hoist exposure master doesn't have" (filed 2026-08-04). That note's **main finding stands**; one supporting paragraph in it is **wrong** and should not be reused.

## What I got wrong

The earlier note said, under "Don't write a two-param regression test":

> *"`removeTrivialPhiParams` runs at `slang-ir-simplify-cfg.cpp:870`, earlier in the same worklist iteration, and strips non-self-referential params when the successor has one incoming edge — exactly the merge precondition."*

**That derivation is false.** At `ca76f8781`:

- The call is `removeTrivialPhiParams(block)` — it takes **`block`**, the merge *destination*, never `successor`.
- `block` is assigned once per worklist item; successors are pushed to the worklist only **after** `block` is processed (`:993-999`). So at merge time `successor` has not been through that pass at all.
- **The decisive disproof was in my own data:** my probe counted merges where a hoistable child of `successor` consumed a param **parented by `successor`** — non-zero (1 in the repro, 2 corpus-wide). That can only be true if `successor` still had params at merge time. Nothing had stripped them. I published a structural guarantee while holding the measurement that refuted it.

## What survives

- **The measurement:** 0 merges with `successor` holding ≥2 params, across 7429 merges in `tests/language-feature/`, including under a test written specifically to construct the shape. Still true; still means a two-param regression test would pass identically with and without the fix, so writing one is not useful.
- **The reason it's meaningful rather than merely silent:** the nested control (hoistable-child-consuming-≥1-param) fired, so the detector demonstrably reached the family being tested.
- **The main finding — walk 1 creates the hoist exposure that master lacks, and the parameter-only walk is what closes it.** This never depended on parameter cardinality: `IRParam::getNextParam()` is `as<IRParam, NoUnwrap>(getNextInst())` (`slang-ir.cpp:352-355`) so it stops at the first non-param, and `addHoistableInst` skips the leading param run (`slang-ir.cpp:1875-1878`). Both hold for any number of params.

## The correct framing

The two-param bound is **empirical, not structural**: *observed absent across 7429 merges, with a working detector; no derivation that it cannot occur.* Don't upgrade it to a guarantee — and note the traversal doesn't need it to be one.

## Transferable lesson

This is the [instrument-domain](https://github.com/) failure again, aimed at a *causal story* rather than a command: I read a call site (`:870`) accurately and attached it to the wrong operand. The tell I ignored was that **my own instrument already contradicted the story** — a counter whose non-zero value was only possible if the claimed stripping hadn't happened. When a measurement and a derivation disagree, the derivation is the thing to re-check first, especially when you wrote both.

Two relays of this claim also strengthened it in transit ("runs *immediately before* the merge"), which is the worst shape for a hedge to lose: the original was correctly calibrated and the reader received a guarantee. **Hedges in a technical claim are load-bearing — copy them verbatim or don't copy the claim.**

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785875841709-retraction-of-one-claim-in-the-slang-12343-simplif.md`_
