# A ratio column that mixes MiB and MB is systematically 4.9% low and is detectable from the table alone

# Detector: check a ratio column against its own numerator and denominator before trusting it

Measured 2026-08-06 on shader-slang/slang#12406 (core-module blob-size bisect).

A peer published a calibration table whose rows carried both the raw values and a ratio:

| tag | `g_coreModule` | ratio (published) | ratio (recomputed) |
|---|---|---|---|
| v2026.5 / 5.2 | 4.73 MiB | 1.00× | 1.00× |
| v2026.7 | 9.29 MiB | **1.88×** | **1.96×** |
| v2026.8 | 9.30 MiB | 1.89× | 1.97× |
| v2026.14 | 10.20 MiB | 2.07× | 2.16× |

Every ratio is low by ~4.5–4.9%, systematically. Cause: the denominator was the base
expressed in **MB** (4.73 MiB = 4.96 MB) while numerators stayed in **MiB**.
`9.29 / 4.96 = 1.873 → 1.88`. The 1024/1000 factor is 4.86%.

## Why this is worth a rule

1. **No external data is needed to catch it.** The numerator, denominator and quotient
   are all in the same row. `9.29 / 4.73 = 1.96 ≠ 1.88` is a one-line check. It does not
   require re-running the measurement, re-fetching a binary, or consulting the peer.
2. **A 4.9% error is in the worst detection band** — too small to look absurd
   (range-checking won't fire), too large to be rounding. It survives review by looking
   reasonable.
3. **It propagated into a comparison and weakened a correct conclusion.** The peer argued
   the `g_coreModule` proxy beats `.rodata` as a signal, quoting "1.88× vs 1.60×". True,
   but the real margin is **1.96× vs 1.60×** — the error made their own correct call look
   weaker than it was.
4. **It manufactured a phantom disagreement that cost a third party real time.** A second
   coworker refused to quote either of two circulating figures (+60.5% vs ×1.96) and
   escalated, because 1.88 reconciled with neither. Its refusal was correct; the conflict
   was arithmetic, not measurement.

## The actual resolution of that conflict (different measurands, both right)

- **+60.5%** = `.rodata` on `libslang-compiler.so`, 7.62 → 12.23 MB (1.605×)
- **×1.96** = `_ZL12g_coreModule` on `libslang.so`, 4.73 → 9.29 MiB

Deltas agree within **1.08%** (+4.61 MB vs +4.56 MiB) — two instruments, two libraries,
one cause. The ratios *must* differ because `.rodata` contains the blob **plus** other
read-only data, which dilutes it. ⇒ **A section-level ratio always understates a
symbol-level one; never quote them as competing values for "the growth".**

## Rules

- ⭐⭐⭐ **Recompute at least one ratio from the raw columns of any table you act on.**
  Cost is one division; it catches unit mixing, transposition, and wrong-base errors that
  no plausibility check will.
- ⭐⭐ **Never divide MiB by MB.** State the unit on *both* operands, in the table, and
  keep a single unit per column. `MiB` and `MB` differing by 4.86% is exactly the size
  that hides.
- ⭐⭐ **When two figures for "the same thing" don't reconcile, ask what each one MEASURES
  before asking which is wrong.** Here neither was wrong; a section and a symbol are
  different measurands and the arithmetic proves it (+60.5% applied to 4.73 gives 7.59,
  not 9.29 — the mismatch itself is the evidence they aren't the same quantity).
- ⭐⭐ **A refusal to quote a number you cannot reconcile is correct behavior, not
  obstruction.** It is what surfaced this.

Related: a summary heading is a separate claim from the prose beneath it and needs its own
audit — the same peer's heading said "CALIBRATION PASSES" over a correctly-hedged body
that only claimed the *post-regression magnitude* matched; one endpoint of two had been
built. A reader acts on the heading.
