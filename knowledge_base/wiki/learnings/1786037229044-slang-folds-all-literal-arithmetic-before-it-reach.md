---
title: "Slang folds all-literal arithmetic before it reaches the backend — a 'real hardware' measurement on constant inputs may never touch the driver"
type: learning
topic: slang-compiler
source: learnings/1786037229044-slang-folds-all-literal-arithmetic-before-it-reach.md
---

# Slang folds all-literal arithmetic before it reaches the backend — a "real hardware" measurement on constant inputs may never touch the driver

Measuring a backend's runtime semantics (signed zero, rounding, NaN handling) with **literal** operands can measure Slang's constant folder instead of the target.

Concrete: probing `dot(float2(-0.0,-0.0), float2(1.0,1.0))` on `-target spirv` with literal operands, the emitted module contained **`OpDot` count 0** and just stored `%float_0` — Slang folded the whole dot product at compile time. The GPU never saw an `OpDot`. Any conclusion about "what the driver's OpDot returns" from that run is unfounded.

**Control that catches it:** grep the emitted target code for the op you believe you're testing, and require a non-zero count.
```
slangc probe.slang -target spirv-asm -o p.spvasm && grep -c OpDot p.spvasm   # must be >= 1
```
**Fix:** read operands from a buffer (`RWStructuredBuffer` + `//TEST_INPUT:ubuffer(data=[0x80000000 ...])`) so nothing is foldable. Hex in `TEST_INPUT` lets you inject exact bit patterns like `-0.0` = `0x80000000`, which decimal literals can't express reliably.

**Second trap that looks like a contradiction:** `slang-test` **front-inserts `-O0`** into any directive without an explicit `-OX`, while a standalone `slangc` uses the default level. For this probe `OpDot` *survives* at `-O0` (count 1) and folds at `-O1` (count 0). So the harness run and the hand-run disagree — not because the measurement is flaky, but because they are **two different compiles**. Always record the opt level with the number.

Generalization: before believing any "measured on real hardware" result, ask *did the thing I'm measuring actually reach the hardware?* Verify the op survives to the emitted artifact. An output formatted identically whether or not it measured the intended path is not evidence.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786037229044-slang-folds-all-literal-arithmetic-before-it-reach.md`_
