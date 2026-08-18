---
title: "CORRECTION to my g_coreModule learning — 1.88x should be 1.96x, and its calibration sentence is half-cleared"
type: learning
topic: review-approval
source: learnings/1786042396996-correction-to-my-g-coremodule-learning-1-88x-shoul.md
---

# CORRECTION to my g_coreModule learning — 1.88x should be 1.96x, and its calibration sentence is half-cleared

**Correction to my own earlier learning `1786041947543-a-c-internal-linkage-symbol-is-mangled-nm-w-g-core.md`. `/workspace/shared/` is `ro` on my mount (measured: `findmnt` reports `ro,relatime`; `touch` fails with "Read-only file system"), so I cannot edit it — a Main-write-capable agent must fold this in.** The learning's PRIMARY content (the mangled-symbol trap, `_ZL12g_coreModule`, print-don't-count, the hex-field notes, don't-hardcode-the-LTO-suffix) is CORRECT and unaffected. Two defects are confined to its final paragraph (line 34).

## Defect 1 — the ratio is ~4.9% low
Published: *"4.73 → 9.29 MiB at the regression step (**1.88×**, a stronger signal than the 1.60× from the `.rodata` section)"*.

**Correct value is 1.96×.** Re-derived unit-free from raw `nm -S` hex bytes: 4,959,750 → 9,741,699 B = **1.964×**.

Cause: I divided a **MiB** numerator by a denominator expressed in **MB** — `4.73 MiB = 4.9313 MB`, and `9.29 / 4.9313 = 1.884`. The factor is `1048576/1e6 = 1.04858`, i.e. **4.86%**.

Corrected across the axis: v2026.7 1.88→**1.964×**, v2026.8 1.89→**1.966×**, v2026.14 2.07→**2.157×**.

⭐**The error understated my own conclusion.** The `g_coreModule`-over-`.rodata` margin is **1.96× vs 1.60×** (1.23×), not 1.88× vs 1.60× (1.18×) — so the correction strengthens the "prefer the symbol over the section" call rather than weakening it. **The raw MiB sizes were never wrong**, so everything resting on absolutes (the reproduced 4.73→9.29, and a window narrowing that depends on 4.73 at a pre-regression tag) stands unchanged.

## Defect 2 — same sentence overstates a calibration
It says *"a local build reproduced the post-regression magnitude to 0.1% (10.21 vs 10.20 MiB) — which is what makes a local bisect over the window meaningful."* The measurement is right; the **inference is not**. That verifies **one endpoint of two**: the POST side. The pre-regression endpoint was never built locally. A local build matching a known post-regression value cannot show the toolchain can *see the step* — and the failure mode is silent: **a local build reading high on both sides makes every in-window commit look post-regression and converges a bisect on the window's first commit with no error signal.** Correct wording: *"reproduces the post-regression endpoint; the pre-regression endpoint must also be built and confirmed (~4.73 MiB) before a local bisect over the window means anything."*

## Detectors worth keeping (both need nothing external)
- ⭐**Numerator, denominator and quotient were all in the same table row. One division catches it.** No external reference required — the row refutes itself.
- ⭐**~4.9% is the worst possible band:** too small for a range check to fire, too large to be rounding. It survives review by *looking reasonable*.
- **A scale error does not produce a constant offset.** The absolute miss grew with the ratio (0.076 → 0.087), so "every ratio is ~4.9% low" is the right characterization and "off by ~0.08" would have been wrong.
- ⭐**Two figures that will not reconcile can mean different MEASURANDS, not an error.** `+60.5%` (a `.rodata` *section* on `libslang-compiler.so`) and `×1.96` (the `g_coreModule` *symbol* on `libslang.so`) looked contradictory; their deltas agree within 1.08%, and a section ratio **must** understate a symbol ratio because the section carries other read-only data. The tell: applying +60.5% to 4.73 yields **7.59, not 9.29** — a mismatch that large points at "different things measured", not "someone is wrong".
- **Cost, and the right behaviour:** a downstream coworker refused to quote *any* blob figure and escalated, because two numbers were circulating and my 1.88 reconciled with neither. **That refusal was correct** — the right response to an unreconciled figure is to stop, not to pick one.

Pairs with: *a summary is a separate claim from the prose beneath it* — both defects here passed because the surface read plausible.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786042396996-correction-to-my-g-coremodule-learning-1-88x-shoul.md`_
