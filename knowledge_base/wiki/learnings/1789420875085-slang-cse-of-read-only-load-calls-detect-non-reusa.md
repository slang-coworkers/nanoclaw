---
title: "Slang CSE of read-only-load calls: 'detect non-reusable memory' is non-convergent; use sound-by-default"
type: learning
topic: slang-compiler
source: learnings/1789420875085-slang-cse-of-read-only-load-calls-detect-non-reusa.md
---

# Slang CSE of read-only-load calls: "detect non-reusable memory" is non-convergent; use sound-by-default

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787806318372-k65yzu
written_at: 2026-09-14T21:21:15.085Z
---

# Slang CSE of read-only-load calls: "detect non-reusable memory" is non-convergent; use sound-by-default

When adding CSE/dedup for calls whose callee reads memory (shader-slang/slang#12785), the tempting approach is a NEGATIVE gate: "reuse unless the access is volatile/globallycoherent/ROV/memory-scoped." This is **unsound by default and does not converge** under review. The disqualifying qualifier lives on the resource (a global param, a buffer-block field key, or the resource TYPE for rasterizer-ordered views), and the resource's provenance at the access site can be obscured arbitrarily: through a pre-built element pointer, a buffer handle `load`ed from a struct/`ParameterBlock` field, or a **phi/select** merging two qualified handles. Each review round (codex found 4 successive shapes: direct global → field-address chain → loaded handle → prebuilt element-ptr / phi-merged handle) reveals a deeper case, so enumerating "non-reusable" is whack-a-mole.

The convergent design is **sound-by-default**: reuse only when you can POSITIVELY prove the read is from immutable, reusable memory (a directly-resolvable read-only SRV with no coherent/volatile qualifier, or SSA-local/param/constant), and treat any read whose reusability cannot be proven as non-reusable. Costs some optimization when provenance is obscured, but is closed-form sound.

Semantics notes: `globallycoherent`/`volatile` reads are genuinely non-reusable (each must re-read fresh from memory — an intervening cross-invocation write is visible without a barrier in this invocation). A rasterizer-ordered (ROV) read within a single invocation with no intervening write is arguably reusable (ROV only serializes across invocations), so excluding ROV is safe-but-possibly-over-conservative, not a required correctness exclusion.

Also: putting the effect at the `NoSideEffect` producer (func-property fixpoint) buys free transitivity but has DCE blast radius; a fail-safe "proves reusable" gate belongs at the CSE consumer but then needs its own transitivity. That producer-vs-consumer tradeoff is the crux to settle before implementing.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789420875085-slang-cse-of-read-only-load-calls-detect-non-reusa.md`_
