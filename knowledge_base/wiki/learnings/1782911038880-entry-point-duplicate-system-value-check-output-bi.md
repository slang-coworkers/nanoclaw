---
title: "Entry-point duplicate system-value check: output-binding-space keying (mesh=category, geometry=per-stream) + inout-stream double-collection hazard"
type: learning
topic: misc
source: learnings/1782911038880-entry-point-duplicate-system-value-check-output-bi.md
---

# Entry-point duplicate system-value check: output-binding-space keying (mesh=category, geometry=per-stream) + inout-stream double-collection hazard

When adding a whole-entry-point "same system value bound twice" diagnostic in Slang's front end (`validateEntryPoint` / `validateSystemValueSemantic`, source/slang/slang-check-shader.cpp), the ONLY hard part is the collision key's **output binding space** — a flat `direction+name+index` key false-positives on real mesh/geometry shaders. Model it by ROLE, and the rules for mesh vs geometry are OPPOSITE:

- **Classic stages (vertex/fragment/hull/domain/compute):** one output space → empty space key. Two `out SV_Target0` params, and two `SV_Target0` fields of a returned struct, correctly collide.
- **Mesh:** space = the output CATEGORY, derived from the `MeshOutputType` subtype (`VerticesType`/`PrimitivesType`/`IndicesType`) at the point the walk already unwraps it. Two same-category `OutputVertices` collide (they alias the single vertex array); vertex-vs-primitive don't. Keying mesh by PARAMETER POSITION is WRONG — two `OutputVertices` get different positions and the dup is missed.
- **Geometry:** space = the STREAM PARAMETER (paramN). Here parameter identity IS correct, because each output stream is a distinct parameter/binding space and all streams share an element type (nothing else distinguishes them). Within-stream dup (a stream element struct with two `SV_Position`) collides; cross-stream doesn't.

**The landmine (cost me a full CI-regression risk + a review round):** geometry streams are declared `inout TriangleStream<T>`. The call-site InOut branch issues an *input* call AND an *output* call; the stream/mesh wrapper type force-resolves BOTH to `Output` inside `validateSystemValueSemantic`, so the stream's outputs get collected TWICE → spurious self-collision → false-positive on a perfectly valid single-SV stream (e.g. tests/spirv/geometry-shader.slang, whose GsOut has one SV_Position). FIX: at the call site's InOut branch, detect output-only-by-type params — `unwrapConditionalType(param->getType())` is a `MeshOutputType`/`HLSLStreamOutputType` (mirrors the existing wrapper checks at slang-check-shader.cpp:1765/1800) — and SKIP the spurious input call; the output call covers them. Semantically correct: a stream is output-only, its `inout` input half carries no semantic. Genuine `inout` scalars (non-wrapper types) keep both calls; mesh output params are bare (else branch) and unaffected.

**Testing mechanics (`DIAGNOSTIC_TEST:SIMPLE(diag=TAG)`):** `//TAG: E30706` with NO caret is a SimpleSubstring annotation — it matches by error CODE against ANY diagnostic (line/column-independent), and exhaustive mode then requires NO other diagnostic. So a case only needs to emit exactly one target diagnostic and otherwise compile clean; annotation placement is irrelevant to matching. Each `-entry X` invocation compiles the whole file but ONLY the selected entry runs `validateEntryPoint`, so multiple entry-point test cases coexist in one file without interfering. Minimal valid mesh boilerplate to reach the check: `[outputtopology][numthreads]` + `OutputVertices` + `OutputIndices` + `SetMeshOutputCounts` (no `OutputPrimitives` needed). Minimal GS: `[maxvertexcount]` + `inout TriangleStream<T>` + `outStream.Append`. (matcher source: tools/slang-test/diagnostic-annotation-util.cpp — SimpleSubstring path ~L461, position-based ~L544.)

Ref: shader-slang/slang#6319, draft PR #11885.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782911038880-entry-point-duplicate-system-value-check-output-bi.md`_
