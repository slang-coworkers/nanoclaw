---
title: "Verifying the figures is not verifying the argument built on them — and test the guard, don't cite it"
type: learning
topic: ci-tooling
source: learnings/1785897523808-verifying-the-figures-is-not-verifying-the-argumen.md
---

# Verifying the figures is not verifying the argument built on them — and test the guard, don't cite it

Two closely-related traps, both hit on shader-slang/slang#12353 (2026-08-05) by agents who were actively hunting for exactly this class of error.

## 1. A figure and the framing built on it are separate claims

A peer asserted: *the three C++ diagnostic catalogs sharing the compiler code space occupy distant bands (`lexer {10000-10013}`, `json {20000-20012, 30000}`, `misc {…100000-100005}`), therefore a collision in the 100–129 band is **structurally impossible** with the current catalogs.*

I reproduced their figures independently with a different matcher, ran **controls in both directions** (four codes their earlier matcher had dropped: all FOUND; two codes that must be absent: both absent), reported "reproduces exactly," and said I'd rely on the conclusion.

**The figures were right and the framing was false.** `misc` is not band-confined — it mixes `-1`, `29104` and `99999` among its `100000+` codes. So "these catalogs live in distant bands" is untrue of the very catalog that matters, and nothing structurally prevents a future entry near 100. The data supports **current absence**, not **structural exclusion**.

Worse: `-1` was in the peer's *own printed output*. They had the refuting datum on screen and drew the opposite conclusion. And my controls — genuinely rigorous — only ever proved that *the matcher discriminated*. They said nothing about whether "distant bands" implies "impossible."

**Rule: confirming an input to an argument feels like confirming the argument. It isn't.** After verifying figures, state the inference as a separate sentence and attack it on its own terms: *what would have to be true for these numbers to license this conclusion, and is it?* Especially when the conclusion uses a modal word — impossible, cannot, always, guaranteed. A modal claim needs a mechanism, not a sample.

## 2. Test the guard; don't cite it

The corrected ground was: *code 115 is safe because a cross-catalog validator would fail the build if it collided.* Better ground — an enforced invariant doesn't decay when someone adds a catalog entry, whereas the band inference silently expires.

But **"a validator exists" is itself a claim that reads as safety while potentially being inert.** A guard that never fires protects nothing. Before relying on it, four legs — all of which passed here:

1. **Does the check apply to my case?** The guard skips codes in `intentional_shared_code_list`. Computed the list; confirmed `115 ∉ list`, with `99999 ∈ list` as a control showing exclusion is real.
2. **Can the scanner silently no-op?** It reads whole files (multi-line-tolerant) and **hard-errors on a missing catalog file** — with a comment saying "silently skipping them would let the invariant rot." Good design; verify it, don't assume it.
3. **Does the matcher actually match?** Executed the production pattern (translated faithfully from the Lua) with a **positive control that must fire**: it found `29104 → spirvCoreGrammarJSONParseFailure`, i.e. *the exact historical collision the guard was built for* (#11318). An empty scan and a working scan are indistinguishable without this.
4. **Does a violation reach a hard failure?** Traced `all_errors` → `helpers.lua:1117` → `slang-diagnostics.lua:6158` → `:6160-6161` `error("Diagnostic validation failed:…")`.

Only after all four is "the build enforces it" a fact rather than a hope.

## Corollary worth generalizing

When you have corrected the same class of defect several times, **stop spot-fixing and write the checker.** On the same PR a peer, after four citation errors, wrote a predicate — *for every single-line citation, does the cited line contain the named token, or only a declaration prefix?* — which passed 15/15 and caught two real cases (a `virtual … SLANG_MCALL` line whose token was on the next line, and a function signature whose `return SLANG_FAIL` was four lines down). Same move as fixing a scraper's done-check instead of hand-auditing each of its runs. n corrections is a smell; a predicate is the fix.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785897523808-verifying-the-figures-is-not-verifying-the-argumen.md`_
