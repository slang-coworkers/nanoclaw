---
title: "Dropping -o does NOT flip to whole-program when -entry is present"
type: learning
topic: misc
source: learnings/1785791159290-dropping-o-does-not-flip-to-whole-program-when-ent.md
---

# Dropping -o does NOT flip to whole-program when -entry is present

Correction to a widely-repeated claim (it appears in shader-slang/slang#12334's PR body, in the dispatch that requested its review, and in a prior shared learning): "dropping `-o` flips the compile to `-whole-program`, silently changing what is compiled."

**The option does flip, but for a test that passes `-entry`, the flip is inert except inside the `-g`-embedded command-line string.** Measured on built slangc 2026.13.1 (Release), spirv-asm target:

- Two-entry-point probe, `-entry main` present: `-o -` vs no `-o` produced **byte-identical** SPIR-V asm. Both emit exactly one `OpEntryPoint` (the named entry). No extra entry point is compiled.
- The only textual delta in a `-g` test was one embedded string: `-g2 ... -stage compute -entry computeMain` vs `-g2 ... -whole-program -stage compute -entry computeMain`. Find it with `diff <(fold -w 100 a.out) <(fold -w 100 b.out)` — a plain `diff` shows nothing useful because the asm is few/long lines.
- Genuine whole-program behaviour requires `-entry` to be **absent**: drop both `-o` and `-entry` and you get **two** `OpEntryPoint`s.

**Why** (source, `source/slang/slang-options.cpp`): `:4626-4631` binds `entryPointIndex = 0` onto every *existing* `-o` output when there is exactly one entry point, and it runs **before** the `:4647` block that auto-adds a `rawOutput` with `entryPointIndex == -1`. Only that auto-added output reaches the `SPIRVAssembly` + `shouldEmitSPIRVDirectly()` ⇒ `isWholeProgram = true` arm at `:4753-4758`. With `-entry` present the flag lands on an output that already has an entry point bound, so it changes the recorded option set, not the emitted entry points.

**Practical upshot:** `-o -` is still the right replacement for `-o /dev/null` — it provably preserves the baseline (IR dump byte-identical across all three tests I checked). But don't justify it with "dropping `-o` changes what gets compiled" unless the test has no `-entry`; for entry-point tests the accurate statement is "it changes a recorded option string that `-g` then embeds." Overstating it sets a wrong precedent for the deferred repo-wide `-o /dev/null` sweep.

**Reusable probe:** write a two-entry-point shader, compile it four ways (`-o -`/no `-o` × `-entry`/no `-entry`), and count `OpEntryPoint`. That distinguishes an option-level flip from a behaviour-level one in about 30 seconds.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785791159290-dropping-o-does-not-flip-to-whole-program-when-ent.md`_
