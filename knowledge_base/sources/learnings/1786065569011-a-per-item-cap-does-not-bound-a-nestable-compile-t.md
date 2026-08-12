# A per-item cap does not bound a nestable compile-time construct — measure the nested case before accepting a proposed default

On shader-slang/slang#12399 an internal dev reported that compile-time `$for` has no range-size limit
(compiler eats all memory, never finishes) and proposed a maximum range of 32.

Two measurements changed the recommendation, and neither is visible from reading the code:

1. **The proposed cap was ~3 orders of magnitude too low.** Wall-clock for `$for` expansion:
   32 → 0.76 s, 512 → 1.13 s, **4096 → 1.44 s**, 8192 → 3.7 s, 16384 → 9.5 s, 32768 → 86.5 s.
   The knee is far above the proposed limit. Peak RSS stayed at the ~199 MB core-module baseline
   through N=512 and reached only 260 MB at N=16384 ⇒ **time, not memory, is the binding axis at
   usable sizes**; memory only runs away at pathological N. A limit derived from "feels safe"
   rejects a large band of working programs.

2. ⭐**A per-item cap does not bound a NESTABLE construct.** Three nested `$for(Range(0,32))` — every
   individual range *exactly at* the proposed limit — expands to **32768 instantiations in 49 s**.
   The proposed per-range cap passes that program unchanged. ⇒ for anything that nests, the cap has
   to be on the CUMULATIVE total, not per occurrence. This is a one-command test and it inverts the
   recommendation, so run it before endorsing (or implementing) a per-item limit.

**Anchor a new limit to the compiler's own existing answer, not to a fresh number.** `[ForceUnroll]`
already caps at `kMaxIterationsToAttempt = 4096` (`slang-ir-loop-unroll.cpp:55`) with diagnostic
`cannot-unroll-loop`/E40020. Two different limits for the same conceptual operation are hard to
justify, and the existing constant comes with a diagnostic to model. Verify the precedent *fires*
rather than just reading it: `[ForceUnroll]` over 100000 iterations → `error[E40020]`, with a
must-differ control at 8 iterations compiling clean.

**Also check whether the existing cap could already cover the new case — here it structurally could
not.** `$for` is expanded directly during IR lowering and never becomes an `IRLoop`, so the unroller's
4096 cap can never see it (grep for `Unroll|IRLoop|emitLoop` inside the expansion function = 0). Two
plausibly-related caps can be completely disjoint paths.

**Reproduce a DoS-shaped bug under a cap, with a must-differ control.** `ulimit -v` + `timeout`, plus
the same command at a small size. Note the exit code is a discriminator you must interpret: rc=139
(SIGSEGV) rather than 137 (OOM-kill) looked like a distinct crash, but raising *only* `ulimit -s`
didn't change it ⇒ heap growth, not stack overflow.

**Instrument traps that produced void cells (all caught by controls):**
- `/usr/bin/time` absent ⇒ every cell of a cost matrix failed identically, control included. A matrix
  whose control fails carries zero information.
- An RSS sampler backgrounding `timeout ... &` and reading `$!` samples **the `timeout` wrapper, not
  the real process** — reported 1–2 MB for a process that ran 9.5 s. Sample the child (`pgrep -P`):
  259 MB, 141 samples. A implausibly-small number is the tell.
- `strings` on a thin driver binary returns almost nothing (2050 entries) — diagnostics live in the
  shared library. The must-hit control returning 0 is what exposed it.
