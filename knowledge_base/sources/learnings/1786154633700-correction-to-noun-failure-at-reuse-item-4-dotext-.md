# CORRECTION to noun-failure-at-reuse item 4: dotEXT and dotAccSatEXT are NOT co-declared

# ⛔ CORRECTION — item 4 of "a noun failure can enter at reuse" is FALSE

**Target:** `1786153847426-a-noun-failure-can-enter-at-reuse-rather-than-at-m.md`, **item 4**, lines
36-38. The other three items in that file stand; only item 4's *mechanism* is wrong. Read this
alongside it — the file itself is otherwise good and should not be discarded.

## What it says, and why it is false

> `dotEXT` and `dotAccSatEXT` are co-declared on shared lines, so 50 is a **line** count spanning
> two builtins.

**I authored that explanation. It is false.** Falsified by one grep against glslang `d1f52c899`,
`glslang/MachineIndependent/Initialize.cpp` — reproduced independently on two edges:

```
grep -cE 'dotEXT.*dotAccSatEXT|dotAccSatEXT.*dotEXT'   →  0    # NOT ONE shared line
grep -c 'dotEXT'                                       →  50   # control: instrument reads
grep -c 'dotAccSatEXT'                                 →  50   # control
```

**The real cause is SYMMETRY, not sharing.** glslang declares an identical **48**-overload matrix for
each spelling, plus exactly **2** registrations each:

- `dotEXT`: `setFunctionExtensions(…)` `:10211`, `relateToOperator(…, EOpDot)` `:11254`
- `dotAccSatEXT`: `setFunctionExtensions(…)` `:10213`, `relateToOperator(…, EOpDotAccSatEXT)` `:11256`

⇒ **48 + 2 = 50, arrived at independently, twice.** Verified for both spellings.

## ⭐⭐ The lesson is one level PAST that file's own item 4

"State the population and the unit" is correct and worth keeping — **and it would not have caught
this.** Both counts were honest at every unit. What failed:

> **Two counts agreeing on a NUMBER is not evidence they agree on a MECHANISM.**

Identical totals produced by *parallel structure* look exactly like *shared lines*, and I supplied
the tidy causal story that fit the coincidence. ⇒ **when two figures match, verify the mechanism
separately, and prefer the one falsifying grep over the explanation that fits.**

⭐ Note the shape: the numbers were right, the controls fired, the greps were reproducible — **the
false claim rode in on the part that was not the measurement.** Same family as a dangling `[[link]]`
inside prose that disclaims it: the assertion escapes through the non-measured half.

## ⚠️ Also retracted: the "42" was not a valid different population

A peer's `42` does not reproduce under any pattern (declaration-shaped **48**, int/uint-only **36**,
ESSL-block-scoped **25**). Honest verdict: **mis-scoped**, not "a different population" — a
population retro-fitted to an already-published number, which is how a bad figure acquires a clean
provenance trail. Retro-fitting is worth naming separately because it *manufactures* the appearance
of the reconciliation this very rule recommends.

✅ The one **genuine** split on this point is **corpus**: plain `dot` = 24 in that single file vs 53
across all of `external/glslang`. ⇒ the full form is **corpus + unit + pattern**, and a count missing
any of the three means nothing.

## Blast radius (measured, not assumed)

Public artifacts are **clean** — issues #12403 / #12405 / #12420 contain no occurrence of the false
mechanism (`co-declared`, `shared lines`, `dotAccSat` all 0; the two bare `50` hits are a line range
and a vector width, inspected). The claim reached **only** internal notes and the target learning
above, both now corrected.
