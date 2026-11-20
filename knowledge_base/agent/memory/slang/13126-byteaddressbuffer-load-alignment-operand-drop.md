---
type: chain
title: slang#13126 — ByteAddressBuffer.Load<S>() passed to a call segfaults (alignment operand dropped)
description: "TERMINAL (superseded 11-18): specializeFuncsForBufferLoadArgs rebuilt ByteAddressBufferLoad with 2 operands, dropping alignment → OOB getOperand(2) in byte-address legalize → SIGSEGV. Our draft PR #13130 (final APPROVE, never merged) was superseded by maintainer PR #14565; follow-up #14583 filed-only. History in [[13126-byteaddressbuffer-load-alignment-operand-drop_history.md]]."
tags: [slang, byteaddressbuffer, specialization, ir, crash, regression]
resource: https://github.com/shader-slang/slang/issues/13126
---

# slang#13126 — ByteAddressBuffer.Load<S>() into a call segfaults

**TERMINAL 11-18:** PR #14565 "Keep byte-address buffer loads at the call site" (merged 2026-11-18T08:03:39Z)
auto-closed #13126 — a maintainer shipped the same fix class. Our draft PR #13130 was closed as superseded
(dispatched to slang-triager 11-18, housekeeping-closes-2026-11-18, same-tick rule #13966/#14076). The falcor-ci
gate expiry and the P2→P1 ask are moot.

**Follow-up 11-18 08:33Z:** tracking issue #14583 "Restore ByteAddressBuffer load sinking into specialized
callees" was filed by the #14565 chain; disposition per filing policy (bot-authored body with verification
results = Terminal filing): filed-only, no triage dispatched, operator told. Starting a fixer chain on it is the
operator's call.

**New dated entries go to [[13126-byteaddressbuffer-load-alignment-operand-drop_history.md]], not here** — this
record holds current state only. The history sibling carries the five 10-20→11-04 re-chases (all blocked on the
falcor-ci human gate inside the waiting-runs throttle livelock), the round-3 review detail, and the supersede
narrative.

## Owners (historical; chain closed)

- PR mapping → slang-fixer `sess-1789563539753-y5343h`, thread `gh-issue-shader-slang/slang-13126`.
- Triager session `sess-1789562643352-erls9c`. Issue artifact: triager comment `6237522353`.

## Mechanism (the triager's finding)

`input.Load<S>(0)` lowers to a 3-operand `byteAddressBufferLoad` (buffer, offset, alignment=0).
Passing the loaded struct to a call (method, free function, generic `T:I`, interface parameter,
`[noinline]`) runs `specializeFuncsForBufferLoadArgs`. Its rebuild in `slang-ir-specialize-function-call.cpp`
(about :911 and :933) hardcoded 2 operands. `slang-ir-byte-address-legalize.cpp:140` then reads `getOperand(2)`
out of bounds → SIGSEGV. The pass only runs when the struct is >16 bytes with an array, or any struct >128 B
(`isTypePreferrableToDeferLoad`), which is why `float[5]` crashed and `float[4]` did not.
Bisect: #8547 introduced the drop; #11595's explicit-alignment check made it fatal.

## Fix (PR #13130, superseded)

The fixer kept all trailing operands in the rebuild and keyed the specializations on them (also stopped a
`LoadAligned` miscompile that depended on source order), plus a `SLANG_RELEASE_ASSERT(operandCount==3)` in the
legalizer. 6 files, +267/−3; A/B: every crash row failed 10/10 on master, passed 10/10 on the PR; 6 negative
controls byte-identical. slang-reviewer final APPROVE @a616bd3805 (tests 12/12, sweep 1662/1662). The same fix
class shipped in #14565.
