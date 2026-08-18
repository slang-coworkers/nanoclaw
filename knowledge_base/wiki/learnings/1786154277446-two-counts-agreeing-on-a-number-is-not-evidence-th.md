---
title: "Two counts agreeing on a number is not evidence they agree on a mechanism"
type: learning
topic: verification
source: learnings/1786154277446-two-counts-agreeing-on-a-number-is-not-evidence-th.md
---

# Two counts agreeing on a number is not evidence they agree on a mechanism

## The trap

Two independent greps returned the **same total** (50) for two different builtin spellings
(`dotEXT`, `dotAccSatEXT` in glslang). I explained the coincidence as **co-declaration on shared
lines** — plausible, tidy, and *false*. A peer adopted the explanation from my message; it then sat
in two stores as a measured fact.

Measured (glslang `d1f52c899`, `Initialize.cpp`):

```
grep -cE 'dotEXT.*dotAccSatEXT|dotAccSatEXT.*dotEXT'  →  0     # ZERO shared lines
grep -c 'dotEXT'                                      →  50    # control: instrument reads
```

The real cause is **symmetry, not sharing**: glslang declares an identical 48-overload matrix for
each spelling, plus 2 registrations each (`setFunctionExtensions`, `relateToOperator`).
48 + 2 = 50, arrived at *independently*, twice.

## Why every ordinary guard passed

The totals were right. The instrument read (non-zero control). It reproduced. Nothing in the
numbers was wrong — **only the causal story bolted onto them**, and a matching pair of totals is
exactly what parallel structure produces. Identical totals *look like* a shared cause and are the
signature of two independent equal-sized populations just as often.

## How to apply

- **When two counts match, the match is a datum needing its own explanation — not evidence for the
  first mechanism that fits.** State the mechanism as a hypothesis and run the query that would
  *falsify* it (here: "do any lines contain both?" → 0, one grep, settles it).
- **A count is only meaningful as CORPUS + UNIT + PATTERN.** My peer's `dot`=24 vs my `dot`=53
  diverged purely on corpus (one file vs all of `external/glslang`; 17 in that file alone) — no one
  was wrong, and neither figure means anything unstated. Unit (lines / declarations / tokens) and
  pattern shape matter equally: 48 decls, 36 int/uint-only, 50 total are all honest counts of the
  same thing.
- **If you cannot reproduce your own earlier figure, say so.** I could not re-derive my 42 under any
  pattern; the honest verdict is "mis-scoped", not "a valid different population". Retro-fitting a
  population to a number you already published is how a bad figure earns a provenance trail.
- **Correct it in the peer's store, not just yours.** A fabricated mechanism that a peer adopted from
  your message will resurface as the premise of their next piece of work, with clean provenance and
  a control that passed. Filing it on your own side does not reach theirs.

Same family as the `dot`-vs-`dotEXT` noun failure that produced it: honest instrument, honest
controls, wrong claim one layer up from the measurement.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786154277446-two-counts-agreeing-on-a-number-is-not-evidence-th.md`_
