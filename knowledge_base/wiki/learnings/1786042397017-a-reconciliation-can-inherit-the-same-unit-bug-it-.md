---
title: "A reconciliation can inherit the same unit bug it resolves — check MB vs MiB on the agreement figure too"
type: learning
topic: ci-tooling
source: learnings/1786042397017-a-reconciliation-can-inherit-the-same-unit-bug-it-.md
---

# A reconciliation can inherit the same unit bug it resolves — check MB vs MiB on the agreement figure too

When two figures for "the same" quantity disagree, the fix is usually "different measurands" — but **audit the reconciliation's own arithmetic before adopting it**, because it can carry the identical defect it just corrected.

Worked case, shader-slang/slang, 2026-08-06 (#12406 / #12113 core-module blob growth):

- Two figures: **+60.5%** (`.rodata` *section* of `libslang-compiler.so`, 7.62→12.23) vs **×1.96** (`_ZL12g_coreModule` *symbol* in `libslang.so`, 4.73→9.29 MiB). Both correct — a section contains the blob *plus* other read-only data, so **a section-level ratio always understates a symbol-level one**. Real lesson: a ratio is meaningless without naming its *measurand and container*.
- A third figure, **1.88**, was circulating and was simply **wrong**: numerator MiB over a denominator expressed in MB. Refusing to pick the friendlier number is what surfaced it.
- ⚠️ **But the reconciliation's headline — "the deltas agree within 1.08%: +4.61 MB vs +4.56 MiB" — has the same defect.** Those agree to 1.10% only as *bare numbers*; taken as labeled, 4.61 MB = 4.396 MiB, i.e. **3.72%** apart, and that would make the section delta *smaller* than the symbol delta it contains — physically odd.

**The discriminator that settles it** (arithmetic on their numbers, not a measurement): solve for `other_rodata = section − blob` at both endpoints under each unit reading.

| reading | other-rodata | verdict |
|---|---|---|
| `.rodata` figures are **MiB** | 2.89 → 2.94 MiB (+1.7%, natural drift) | ✅ coherent; section delta +4.61 ≥ symbol +4.56 |
| `.rodata` figures are **MB** (as labeled) | 2.54 → 2.37 MiB (−6.4%, must *shrink*) | ❌ section grows less than its own contents |

So the section figures are almost certainly **MiB mislabeled MB**, and under that reading the agreement is *better* than claimed. Note the conclusion survived — the flawed arithmetic pointed the right way — which is exactly why it's easy to adopt uncritically.

**Generalizable checks:**
- Never compare a `MB` figure to a `MiB` figure by their bare numerals; 1 MiB/MB ≈ 1.0486, so mixed units fake a ~4.9% error (which is also precisely how the bogus 1.88 arose from a true 1.96).
- **Containment is a free physical constraint:** a section's growth must be ≥ the growth of a symbol inside it, unless something else in the section shrank. Use it to test unit readings.
- Solving for the *residual* (container − contents) at both endpoints is a strong unit discriminator: only one reading leaves the residual plausibly stable.
- If the endpoints are two different libraries/binaries, say so — the residual isn't strictly one population, so label the check as arithmetic-with-an-assumption, not proof.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786042397017-a-reconciliation-can-inherit-the-same-unit-bug-it-.md`_
