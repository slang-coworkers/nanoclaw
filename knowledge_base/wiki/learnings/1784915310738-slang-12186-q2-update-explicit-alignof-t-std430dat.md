---
title: "slang#12186 Q2 UPDATE: explicit alignof(T, Std430DataLayout) query CAN diverge from emitted struct layout — struct-embedding tests MASK it"
type: learning
topic: slang-compiler
source: learnings/1784915310738-slang-12186-q2-update-explicit-alignof-t-std430dat.md
---

# slang#12186 Q2 UPDATE: explicit alignof(T, Std430DataLayout) query CAN diverge from emitted struct layout — struct-embedding tests MASK it

CORRECTION to my earlier "slang#12186 option-a … layout NOT a bug" conclusion. It WAS a bug, and the way I initially missed it is the durable lesson.

## The masking trap
I concluded Q2 "no bug, self-consistent" by embedding a DescriptorHandle in a struct and checking emitted std430 offsets — PR and master matched (h@8, tail@16). That was TRUE but IRRELEVANT: in std430 a uint2 has alignment 8, same as uint64, so the offsets coincide and mask the bug.

The maintainer then gave the EXPLICIT two-arg layout query:
  static_assert(alignof(DescriptorHandle<RWStructuredBuffer<float>>, Std430DataLayout) == alignof(uint2, Std430DataLayout));
This FAILS on the PR: the handle reports 4, uint2 reports 8. The handle was reporting NATURAL alignment (4) for EVERY layout rule.

## Root cause (real bug, fixed)
`slang-ir-peephole.cpp` AlignOf/SizeOf peephole has a DescriptorHandle special-case. It resolves `layoutRules` from the query's 2nd operand, picks underlyingType=uint2/uint64 correctly, then calls `getNaturalSizeAndAlignment(...)` — HARDCODED to natural rules, dropping `layoutRules`. For uint64 natural==std430==8 so invisible; for uint2 natural(4)≠std430(8) so the explicit query is wrong. Fix: `getSizeAndAlignment(targetReq, layoutRules, underlyingType, &out)` (what the generic path 20 lines below already does). One-line-class fix, commit 107f158ffe on #12186.

## Durable lessons
1. **Test the explicit layout QUERY directly (`sizeof`/`alignof(T, LayoutRule)`), not just emitted struct offsets.** Struct offsets can coincidentally match under one rule and hide a query bug. std430 uint2-align==uint64-align==8 is exactly such a coincidence.
2. When a representation changes width/vector-ness (uint64→uint2), the `sizeof`/`alignof` peephole is a width consumer that must honor BOTH the width AND the requested layout rule. Grep the AlignOf/SizeOf peephole special-cases for hardcoded `getNaturalSizeAndAlignment` when auditing any type whose representation you changed.
3. A reviewer's minimal repro (a `static_assert`) is worth more than my elaborate struct test — run their EXACT repro first.
4. Own the correction plainly: I told the maintainer "you're right, it is a real bug, my earlier no-bug was based on tests that masked it" — better than defending the wrong call.

Verified post-fix: buffer handle std430/std140=8, natural=4; texture handle (uint64)=8 all rules; matches uint2/uint64_t respectively.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784915310738-slang-12186-q2-update-explicit-alignof-t-std430dat.md`_
