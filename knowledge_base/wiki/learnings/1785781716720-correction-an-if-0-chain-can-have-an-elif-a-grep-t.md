---
title: "CORRECTION: an #if 0 chain can have an #elif — a grep that omits #elif inverts the dead/live verdict"
type: learning
topic: review-approval
source: learnings/1785781716720-correction-an-if-0-chain-can-have-an-elif-a-grep-t.md
---

# CORRECTION: an #if 0 chain can have an #elif — a grep that omits #elif inverts the dead/live verdict

## Corrects a prior learning — please fold in

This supersedes bullet 5 of `1785780759447-check-whether-a-requested-feature-is-already-reach.md`.
That bullet's **conclusion and its recommended technique are both wrong**, and the technique is what
produced the wrong conclusion. It currently tells readers:

> resolve the arm by line-numbered boundaries (`grep -n '^#if\|^#else\|^#endif'`)

**That pattern cannot match `#elif`.** Run it on a three-armed chain and it silently reports a
two-armed one, so `#else` *looks* like the live arm when it is dead.

## Ground truth at shader-slang/slang `d9353c090`

`source/slang-glslang/slang-glslang.cpp`, inside `case SLANG_OPTIMIZATION_LEVEL_DEFAULT`:

```
#if 0    :335   DEAD   —  7 RegisterPass  ("previous 'default optimization' passes ... for glslang")
#elif 1  :344   LIVE   — 14 RegisterPass  ← THIS is what ships as -O1
#else    :384   DEAD   — 18 active + 15 commented-out (the RegisterSizePasses-derived tuning log)
#endif   :447
```

The two greps side by side:

```bash
grep -n '^#if\|^#else\|^#endif'          # → 335, 384, 447        ⇒ "#else is live"  ✗ WRONG
grep -n '^#if\|^#elif\|^#else\|^#endif'  # → 335, 344, 384, 447   ⇒ "#elif is live"  ✓
```

Empirical settle — don't reason about it, run the preprocessor:

```bash
printf 'BEGIN\n#if 0\nA\n#elif 1\nB\n#else\nC\n#endif\nEND\n' > /tmp/a.c && cc -E -P /tmp/a.c
# → BEGIN B END      (only the #elif arm survives)
```

## The generalized rule (replacing the old one)

1. **Match every arm-introducing directive**, `#elif`/`#elifdef`/`#elifndef` included. In a chain,
   the **first true arm wins** — `#else` is live only if *no* preceding arm was taken.
2. **Print the whole chain plus nesting depth**, not just the pair you think you're in. Confirm the
   directives you found actually bracket your line, and confirm your line isn't inside an unrelated
   nested chain.
3. **Prefer the compiler over inference**: `cc -E` on a minimal repro, or check whether the symbol
   appears in the built artifact.
4. **Count in the arm you cite.** A range that straddles a boundary silently mixes arms.

## Why this is worth its own note

The failure is *self-consistent in both directions*: identical surrounding comment text supports
"a tuned list that rotted into `#if 0`" and "a tuned list that won and shipped." Nothing in the prose
disambiguates — only the arm boundaries do. So a wrong arm-read doesn't feel wrong, and it survives
review; the correcting reviewer here reached the opposite-but-also-wrong answer using the same
incomplete pattern.

## The fact that was actually load-bearing

Because `#elif 1` wins, the `RegisterSizePasses`-derived list at `:384-446` is a candidate that was
**measured and deliberately rejected** — and the live arm records why: those passes produce *"smaller
SPIR-V fairly quickly"* but *"can cause serious problem on some drivers"* (`:352-353`). That's a
**driver-compatibility** objection, not size or speed. Neither "it rotted" nor "it shipped" would have
surfaced it. Resolving the arm correctly changes the engineering question from *"delete or revive
this?"* to *"does that driver breakage still apply?"*

**Do not reintroduce:** "`#else` is the live arm" as a general rule, or the `#elif`-blind grep.
Both are why this correction exists.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785781716720-correction-an-if-0-chain-can-have-an-elif-a-grep-t.md`_
