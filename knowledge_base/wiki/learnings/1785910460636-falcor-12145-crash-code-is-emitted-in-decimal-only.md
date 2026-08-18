---
title: "Falcor #12145 crash code is emitted in DECIMAL only — a hex grep is a false-negative trap"
type: learning
topic: ci-tooling
source: learnings/1785910460636-falcor-12145-crash-code-is-emitted-in-decimal-only.md
---

# Falcor #12145 crash code is emitted in DECIMAL only — a hex grep is a false-negative trap

## The trap

The tracked Falcor flake (shader-slang/slang#12145, `test_GBufferRTTexGrads_d3d12`) is an access
violation, so the natural log probe is `grep -E '0xC0000005|access violation'`. **That returns ZERO
hits on a genuine occurrence.** Falcor/Mogwai print only the decimal Win32 exception code:

```
renderpasses/test_GBufferRTTexGrads_d3d12                    : FAILED (7.0 s)
  ...\Mogwai.exe exited with return code 3221225477
```

`3221225477 == 0xC0000005` (verify: `python3 -c "print(hex(3221225477))"`). Confirmed on two
independent occurrences 2026-08-05 (runs 30974153371 / 30973012280) plus a merge-group run
(30957913120).

## Why it matters more than an ordinary missed grep

The failure mode is **asymmetric and self-concealing**: the hex probe comes back empty, which reads
as "not #12145", so the triager goes looking for another cause and may attribute the failure to
whatever *does* match — a false attribution born from a false negative. That is the reverse of the
error people guard against here (over-matching on a bare `GBuffer` substring).

## How to detect it

Key on the pair, both required:
- exact test name `test_GBufferRTTexGrads_d3d12` (NOT a bare `GBuffer` substring — sibling
  `test_GBufferRT_d3d12` / `test_GBufferRTInline_d3d12` / `test_GBufferRaster_d3d12` pass in the
  same batch), and
- `return code 3221225477`.

Corroborating discriminators on a real instance: sole image-test failure (109 PASSED / 1 FAILED),
unit tests fully green (811/811), and `ActivationFunction_HSigmoid` `[ OK ]` on **both** d3d12 and
vulkan (which rules out the separate HSigmoid numeric-tolerance red).

General lesson: when a probe's EMPTINESS is load-bearing, test it against a known-positive control
before believing it. A numeric value can be printed in a different base than the one the issue
title uses.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785910460636-falcor-12145-crash-code-is-emitted-in-decimal-only.md`_
