---
title: "Check whether a requested feature is already reachable via an existing passthrough before scoping it"
type: learning
topic: misc
source: learnings/1785780759447-check-whether-a-requested-feature-is-already-reach.md
---

# Check whether a requested feature is already reachable via an existing passthrough before scoping it

## Rule

When an issue asks for a new preset/mode/flag that wraps a **third-party library's** built-in
functionality, check whether an existing generic passthrough already reaches it — **and prove it by
running the command**, not by reading the plumbing. The "feature" may collapse to ergonomics, which
completely changes triage scope and the recommended sequencing.

## The case (shader-slang/slang#12331, 2026-08-03)

Issue asked for a `-Os` size-optimization preset for the SPIRV-Tools optimizer, plus data on which
passes drive size reduction.

Turned out SPIRV-Tools' `Optimizer::FlagHasValidForm` whitelists exactly two *bulk-preset* spellings
alongside the `--pass-name` forms:

```cpp
// external/spirv-tools/source/opt/optimizer.cpp:288
if (flag == "-O" || flag == "-Os") { return true; }
```

dispatched at `:532` to `RegisterSizePasses()`. Slang forwards `-Xspirv-opt` args verbatim into
`RegisterPassesFromFlags` (`source/slang-glslang/slang-glslang.cpp:528-533`). So
**`slangc -O0 -Xspirv-opt -Os` already runs the size preset** — zero code change.

Measured (Debug slangc, min of 3): on one shader the size preset was **smaller AND faster than
`-O3`** (13792 B / 587 ms vs 13928 B / 645 ms); on another it matched `-O3`'s size in ~24% less
time. That inverts the framing from "add a size mode" toward "the perf presets may be mistuned."

## Why the generic-passthrough angle is easy to miss

The passthrough was designed for *per-pass* control, and its own triage (the closed predecessor
issue #12204) had **explicitly rejected** exposing bulk presets as out of scope. So the codebase's
own written intent said "presets are not available here" — while the upstream library's flag parser
accepted them anyway. **A passthrough's documented purpose does not bound what the downstream tool
will accept.** Grep the *upstream* flag validator, not just your own wrapper.

Bonus: this also gave a free answer to the "which passes contribute" question — per-pass
leave-one-out A/B is possible today via `-O0 -Xspirv-opt --pass-a --pass-b` with no compiler change.

## Collateral findings worth generalizing

1. **Check whether the flag name is already taken internally.** Slang already emits `-Os` *downstream
   to GCC* for `OptimizationLevel::Default` (`slang-gcc-compiler-util.cpp:1025`). A user-facing
   `-Os` meaning "size" would make one spelling mean two things by target. `grep '"-Os"'` across the
   tree before proposing a flag.
2. **A "no harness exists" claim in an older issue may be stale.** #9192's triage said new tooling
   was needed; `tools/compile-perf/` has since landed with CI workflows and a real large-shader
   corpus. Its only gap was that it records **time but never artifact size** (`grep -rn
   'getsize|st_size'` → zero) despite already writing `out.spv`. Re-derive infrastructure claims
   against HEAD instead of inheriting them.
3. **"The current default" is often three different values.** Product default was `-O1`
   (`s_optimizationLevels`), slang-test injects `-O0`, and the issue/briefing assumed `-O2/-O3`.
   Name which baseline you're reporting deltas against.
4. **Probe shaders must be non-trivial.** A tiny shader was byte-identical at every optimization
   level (168 B), as was a 76 KB *debug-info* test (560 B output). Size effects only appear on
   shaders with real code volume — a trivial probe silently "proves" no difference.
5. ⭐⭐ **AN `#if 0` CHAIN CAN HAVE AN `#elif`. A grep that omits `#elif` INVERTS the dead/live
   verdict — and the incomplete grep is what produces the inversion.**
   ⚠️ **THIS BULLET WAS WRONG TWICE. Final ground truth, settled 2026-08-03 by running the
   preprocessor** (triager's re-derivation, independently re-verified by Main at the same SHA
   `d9353c090`; fetch byte-identical to `master`):

   ```
   source/slang-glslang/slang-glslang.cpp, inside case SLANG_OPTIMIZATION_LEVEL_DEFAULT:
   #if 0    :335   DEAD   —  7 RegisterPass  ("previous 'default optimization' passes ... glslang")
   #elif 1  :344   LIVE   — 14 RegisterPass  ← THIS is what ships as -O1
   #else    :384   DEAD   — 18 active + 15 commented-out (RegisterSizePasses-derived tuning log)
   #endif   :447
   ```

   ⛔ **DO NOT REINTRODUCE — both retracted readings, and the tooling that caused them:**
   - ❌ *v1 (triager, original):* "`#else` :384-446 is a **disabled** pass list / a tuned list that
     **rotted into `#if 0`**" — right that it's dead, but never said **why**, and it implied the
     `#if 0` arm was the live one.
   - ❌ *v2 (Main's "correction"):* "**`#else` IS THE LIVE ARM** … it is the shipping `-O1` default,
     dead arm = :336-383 with 21 `RegisterPass` calls." **Flatly wrong.** `#else` is dead. The "21
     calls in :336-383" figure is an artifact of merging the dead `#if 0` arm (7) with the live
     `#elif` arm (14) — the seam at :344 was invisible to the grep.
   - ❌ **The recommended technique itself:** `grep -n '^#if\|^#else\|^#endif'` — **cannot match
     `#elif`.** On this file it returns only 335/384/447, reporting a **two**-armed chain where a
     **three**-armed one exists, which is exactly what makes `#else` look live.

   ✅ **Corrected rule — first true arm wins; match every directive; count inside the arm you cite:**
   ```bash
   # WRONG — #elif-blind, silently reports a two-armed chain
   grep -n '^#if\|^#else\|^#endif'                                  # → 335, 384, 447        ✗
   # RIGHT — include #elif (and tolerate indentation)
   grep -nE '^[[:space:]]*#[[:space:]]*(if|ifdef|ifndef|elif|else|endif)'   # → 335,344,384,447 ✓
   # SETTLE IT — don't reason about arm selection, run the preprocessor:
   printf 'BEGIN\n#if 0\nA\n#elif 1\nB\n#else\nC\n#endif\nEND\n' | cc -E -P -   # → BEGIN B END
   ```
   In a chain, **the first arm whose condition is true wins and every other arm is dead** — so with
   `#if 0` / `#elif 1`, the `#else` is unreachable. A comment quoted from inside *any* arm tells you
   nothing about which arm ships.

   **Why this fooled two tiers in sequence:** the mistake is self-consistent in both directions.
   "A tuned list that rotted into `#if 0`" and "a tuned list that won and shipped" are opposite
   conclusions drawn from *identical* surrounding comment text; nothing in the prose disambiguates,
   only the arm boundaries do — and the tool both readers used to find those boundaries was blind to
   the seam. **A correction built on the same broken instrument reproduces the error with more
   confidence.** When you correct someone on arm selection, re-derive with a *different* instrument
   (the preprocessor) rather than a better-run version of theirs.

   ⭐ **The substantive finding neither reading surfaced — read the live arm's own comment.**
   `:352-353` says the `#else` passes produce *"smaller SPIR-V fairly quickly"* but *"**can cause
   serious problem on some drivers**"*, and `:355-356` that they yield *"less than half size of the
   previous -O1 passes."* The `RegisterSizePasses`-derived list was rejected **deliberately, over
   driver compatibility** — not over size, not over speed, and not by rot. So for a size-preset
   question the live question is **"does that driver breakage still apply to current drivers?"** —
   if not, that block is a ready-made candidate pass set; if so, it is the constraint that bounds
   *any* size preset. Shipping `-O1` is a **hybrid** (previous default + some size passes, `:350-356`),
   so "the current preset is tuned for runtime performance" holds most clearly for **`-O2/-O3`** —
   that is where the mistuned-presets question lives.

## One DeepWiki claim was wrong

DeepWiki asserted the optimizer call is disabled by `#if 0` in `createArtifactFromIR`. Misleading —
the live path invokes it via the downstream-compiler interface, and my size probes prove the
optimizer runs (output bytes change per level). Empirical probes beat doc-tool paraphrase for
"is this code actually live."

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785780759447-check-whether-a-requested-feature-is-already-reach.md`_
