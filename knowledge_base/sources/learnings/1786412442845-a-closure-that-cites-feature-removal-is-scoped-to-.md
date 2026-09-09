---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786399388291-ddxma8
written_at: 2026-08-11T01:40:42.845Z
---

# A closure that cites feature removal is scoped to the versions that removed it — check the DEFAULT path before treating it as a dedup

# A closure that cites feature removal is scoped to the versions that removed it — check the DEFAULT path

**Measured on shader-slang/slang#12463 (2026-08-11), triaged by slang-triager, closure verified independently by Main against the live API.**

`#12463` (slangc SIGSEGV when `struct Derived : Base` is an entry-point parameter) looked novel. It is
not: **#4451** reports the same assertion at the same site (`slang-ir-glsl-legalize.cpp`,
`structTypeLayout`), and was closed 2025-07-31 by csyonghe with
*"Closing as we removed struct inheritance from the language."*

That closure is **true, and true only for Slang 2026+**. The gate at
`slang-check-decl.cpp:11884-11899` hard-errors `BaseOfStructMustBeInterface` **only** when
`isSlang2026OrLater`; legacy versions emit warning E30816 (`InheritanceUnstable`) and proceed into the
crashing path. Measured, one binary per cell:

| flag | exit | diagnostic |
|---|---|---|
| `-std 2026` | 255 | `error[E30811]` — correct, no crash |
| `-std 2025` | **139** | warning E30816 |
| `-std 2018` | **139** | warning E30816 |
| **default** | **139** | warning E30816 |

⭐ **The removal never removed the crash — it moved it onto the legacy path, which is the DEFAULT.**
So every user who does not pass `-std 2026` still hits it, which is exactly why the "already fixed by
removal" closure did not prevent a second report 12 months later.

## Why this matters beyond this issue

A "we removed feature X" closure reads as *unconditionally* terminal. It usually isn't: removals land
behind a language-version / API-version / config gate, and **the gate's default is frequently the old
behavior** for source-compat reasons. A dedup that stops at *"prior issue closed as removed"* will
close a live crash as a duplicate of a non-fix.

**Why:** the closure records the maintainer's *policy* ("inheritance is going away"), not the
*reachability* of the defect. Policy and reachability are different measurements, and only the second
one decides whether a new report is real.

## How to apply

When a candidate duplicate was closed with removal/deprecation language:
1. **Find the gate** that implements the removal (grep the version predicate — here `isSlang2026OrLater`).
2. **Measure the DEFAULT**, not just the new version. If the default still reaches the defect, the
   closure does not cover the new report — say so explicitly in the dedup, and cite both cells.
3. **Surface the two dispositions rather than picking one.** Fix the legacy path, or extend the
   rejection to legacy versions too (a source-compat break on code that compiles today). Choosing is
   a maintainer call, not a bot call — the patches live in *different files*, so building either
   before the call risks a wasted PR.
4. Quote the closure comment verbatim with its author and date. The scope claim is the load-bearing
   part of the dedup; a paraphrase ("closed as fixed") destroys the evidence that it was conditional.

## Companion: a crash-fix validated by exit code can certify a still-wrong result

Same issue, separate trap. The recommended producer-side fix (add the base walk to the varying layout
path at `slang-parameter-binding.cpp:2791`, modelled on the uniform path at
`slang-type-layout.cpp:5816-5825`) was built on a throwaway build: all four crashing targets went
**139 → 0**. It is still **not sufficient** — with both members used, the emitted GLSL gives
`i_base_a_0` and `i_b_0` **both `location = 0`**, where the equivalent flat struct and the equivalent
explicitly-nested struct correctly get `0` and `1`. The base entry must also advance the
varying-slot/semantic state.

⇒ **For a layout/codegen crash, "exit 0" is the weakest possible pass condition — it certifies only
that nothing read out of bounds, not that the layout it produced is right.** Assert the *value*
(here: the base member's `location`), and compare against a working analog that should be equivalent
(flat struct, explicitly-nested struct). Complements
`1785026926217-fixing-a-crash-can-be-a-multi-layer-cascade-verify` — that one is about a crash fix
*unmasking* deeper layers; this one is about a crash fix *silently producing wrong output* while every
exit code is green.
