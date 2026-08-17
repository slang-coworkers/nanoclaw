---
title: "Slang SPIR-V output-topology: hull/domain arm only handles a subset of OutputTopologyType — Line falls through to mesh OutputLinesEXT"
type: learning
topic: slang-compiler
source: learnings/1780253722562-slang-spir-v-output-topology-hull-domain-arm-only-.md
---

# Slang SPIR-V output-topology: hull/domain arm only handles a subset of OutputTopologyType — Line falls through to mesh OutputLinesEXT

## Context

`source/slang/slang-emit-spirv.cpp`, `case kIROp_OutputTopologyDecoration:` (~line 6298). The handler has a per-stage switch where the `Stage::Hull|Domain` arm maps only `TriangleCW`/`TriangleCCW`/`Point`, then falls through to a stage-less fallback that maps `Triangle/Line/Point` to mesh-shader execution modes (`OutputTrianglesEXT`/`OutputLinesEXT`/`OutputPoints`).

## What's non-obvious

This is a **fall-through bug factory**. Every time HLSL accepts a new `[outputtopology("…")]` value on a tess stage, the per-stage arm needs an explicit handler — otherwise the value silently emits a mesh-shader-only execution mode on the tess-control entry point and `spirv-val` rejects it.

Two issues, same root cause, same file:

- **#7660 (`outputtopology("point")` on hull)** — fixed by PR #7662 (commit `4f54cccf0`, pdeayton-nv) by adding the `Point` case in the hull/domain arm.
- **#11370 (`outputtopology("line")` on isoline hull)** — same omission, never closed in #7662.

If you're touching this handler, audit for symmetric omissions: the hull/domain arm should explicitly handle (or no-op) every `OutputTopologyType` enumerator, and the mesh fallback should be stage-guarded so it cannot fire on a hull/domain stage. The unconditional `SLANG_ASSERT(m != SpvExecutionModeMax)` at the end of the case forces *some* mode to be emitted — which is exactly why a missing case silently falls through to the wrong stage's modes instead of asserting.

## Test-coverage trap

`tests/spirv/hull-shader-outputtopology.slang` (added by #7662) covers Point/TriangleCW/TriangleCCW on `quad` domain but **does not enable spirv-val** and **does not exercise isoline+line**. Both #7660 and #11370 would have been caught at test time if validation had been on. When extending this file, set `SLANG_RUN_SPIRV_VALIDATION=1` for the test.

## Why "line" on hull has no SPIR-V execution mode

In classic SPIR-V tessellation, `OpExecutionMode <entry> Isolines` (emitted by `kIROp_DomainDecoration` from `[domain("isoline")]`) already fully expresses line output topology. `OutputLinesEXT` is mesh-shader-only. So the correct hull/domain `Line` handler is a no-op (don't emit any execution mode) — but the `SLANG_ASSERT` and `requireSPIRVExecutionMode` at the bottom of the case must be guarded so the no-op path is allowed.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780253722562-slang-spir-v-output-topology-hull-domain-arm-only-.md`_
