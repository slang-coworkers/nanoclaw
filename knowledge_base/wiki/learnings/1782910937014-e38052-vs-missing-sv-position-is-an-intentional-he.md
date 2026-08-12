---
title: "E38052 VS-missing-SV_Position is an intentional heuristic false-positive (VS→GS is known-legit)"
type: learning
topic: verification
source: learnings/1782910937014-e38052-vs-missing-sv-position-is-an-intentional-he.md
---

# E38052 VS-missing-SV_Position is an intentional heuristic false-positive (VS→GS is known-legit)

## E38052 "vertex shader has no output with SV_Position" — known intentional heuristic

**Where:** emitted in `validateEntryPoint`, `source/slang/slang-check-shader.cpp:2077-2111` (added by PR #10971 / commit `b7f3dbb0c`). Diagnostic def `source/slang/slang-diagnostics.lua:4427-4432` (severity = **Warning**, C++ name `Diagnostics::VertexShaderMissingSvPosition`).

**Behavior:** gated only on `stage == Stage::Vertex`; warns iff `hasOutputs && !hasSvPosition`, where both are computed from the **single entry point's own signature** (return type + out/inout params) via `_outputDeclHasSemantic` (recurses structs/arrays/ModifiedType/stream-output, case-insensitive "sv_position", matches `SV_Position0`/nested). There is **no pipeline-pairing awareness** — the check does not know whether the VS output feeds a geometry/tessellation/mesh stage vs. the rasterizer.

**Key insight for triage:** the in-code comment at `:2062-2070` *explicitly names* the VS→GS/tess/mesh case (and rasterizer-discard / transform-feedback) as legitimate, calls it "rare," and deliberately does NOT detect it. The motivating request #8753 shows the architect (`tangent-vector`) acknowledged the VS+GS false positive *before* the warning shipped ("Only the last stage before the rasterizer is required to output SV_Position"), and `maxime-modulopi` named the exact point→quad particle VS→GS expansion pattern. It shipped anyway because SV_Position-present is by far the common case, with `-warnings-disable 38052` as the documented escape hatch.

**So:** a report of E38052 firing on a VS→GS shader (e.g. issue #11884, Source 2 `.vfx` VS returning `GS_INPUT`) is a KNOWN, INTENTIONAL heuristic false-positive — not a clear bug. Whether to refine it is a maintainer design/policy call. Realistic options: (A) no code change, keep documented global suppression (likely outcome); (B) add a small per-entry-point opt-out attribute (needs maintainer buy-in for language surface); (C) cross-entry-point GS detection = over-engineering (validateEntryPoint has no pipeline context; doesn't help separately-compiled VS). Reproduces with no GPU: `slangc x.slang -target spirv -o x.spv` on a `[shader("vertex")]` returning a struct with no SV_Position.

Existing tests: `tests/diagnostics/vertex-missing-sv-position{,-positive}.slang` (neither covers VS→GS).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1782910937014-e38052-vs-missing-sv-position-is-an-intentional-he.md`_
