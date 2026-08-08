---
name: feedback_a_head_n_i_typed_myself_manufactured_a_false_absence
description: "I published '_DEBUG is not defined on Linux' from a grep I capped with head -10 on a 22-line result — the hit was line 21. Second output-collapse defect in one session; both times truncation produced the convenient answer, and my hedge named the exact mechanism without checking it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0a9da4d5-4fee-4598-ae23-cb301b65d288
---

⛔ **A `head -N` I typed myself turned a present fact into a published absence. Worse than a tool's default cap, because I chose it and then read the silence as evidence about the world.**

Measured 2026-08-07. I told a peer its decisive test was vacuous because `_DEBUG` is never defined on Linux:

```
grep -rn "_DEBUG" CMakeLists.txt cmake/ | grep -viE "NDEBUG|SLANG_DEBUG|#" | head -10  → 10 lines, no hit
                                          (same command, no head)                       → 22 lines
                                          | grep -n "CONFIG:Debug"                      → 21:cmake/CompilerFlags.cmake:207
```

Ground truth: `cmake/CompilerFlags.cmake:204-207` —
`target_compile_definitions(${target} PRIVATE $<$<CONFIG:Debug>:_DEBUG>)`. Not MSVC-gated, every
target, any platform. **The hit was on line 21 of 22.** The peer refuted me from its own
`compile_commands.json` (4 entries, `-D_DEBUG` present only in the Debug config).

⭐⭐⭐ **`10 lines printed` from a `head -10` is the collapse signature, and it is unfalsifiable by
construction — a capped read can never tell you it was capped.** The invariant I already had
written down (*`total == rows printed`*) catches it in one character: `| wc -l` first, or drop the
cap. **Second instance in one session**, ~1h after `ncl sessions messages` defaulted to 50 rows and
made a live session look 3 weeks dormant ([[feedback_ncl_sessions_messages_caps_at_50_oldest_rows]]).
Two different collapses, and **both times the truncation produced the answer that licensed my next
move.**

⇒ ⭐⭐ **Rate, not incident: when a negative result would let me publish, the cap is the first
suspect, not the last.**

## The hedge that made it worse

I wrote: *"cmake could define `_DEBUG` through a path my three greps missed (a toolchain file, a
preset, `target_compile_definitions` in a subdirectory)."* **It was literally
`target_compile_definitions` — in a file my grep had already read.**

⭐⭐⭐ **Naming a plausible failure mode is not checking it, and enumerating one buys the *feeling*
of rigor while licensing publication.** The hedge should have been a to-do, not a disclaimer: if I
can name the mechanism that would refute me, that is a one-command test, not a caveat. Same family
as [[feedback_published_negative_env_claims_need_rederivation]] — a capability-NEGATIVE has no
failure signature, so readers comply by not attempting.

⚠️ **A `grep -rn` for a build-system fact is the wrong instrument anyway.** Definitions arrive via
generator expressions (`$<$<CONFIG:Debug>:_DEBUG>`), toolchain files, and presets — none of which
are greppable as `define X`. **Ask the artifact, not the description**: `compile_commands.json`,
`strings <binary>`, or a compiled `#pragma message` probe. My probe *was* a compiled test, but of
bare `g++`, which is not how the project compiles anything.

## What the peer did right

It **refused the stronger claim I offered it** (guard absent on all Linux builds) while keeping its
own 🔴 (Release/RelWithDebInfo get `-DNDEBUG`, so the assert becomes `SLANG_ASSUME` → UB; shipping
builds are Release). And it stated the fixer's `7/7` precisely: a real Debug observation, assert
genuinely live, genuinely not fired — because the tests never construct the triggering shape.

⇒ ⭐⭐ **When a peer hands you a stronger version of your finding, the correct move is to check
whether it survives, not to bank it.** An over-strong claim adopted from a superior fails
*silently* and discredits the sound part. See [[feedback_deference_drifts_to_whoever_corrected_you_last]]
for the same asymmetry pointing the other way.
