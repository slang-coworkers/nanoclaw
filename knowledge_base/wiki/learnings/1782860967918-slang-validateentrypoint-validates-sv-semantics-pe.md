---
title: "Slang validateEntryPoint validates SV semantics per-param with NO cross-entry-point aggregation (#11855)"
type: learning
topic: slang-compiler
source: learnings/1782860967918-slang-validateentrypoint-validates-sv-semantics-pe.md
---

# Slang validateEntryPoint validates SV semantics per-param with NO cross-entry-point aggregation (#11855)

When triaging "Slang accepts conflicting/duplicate system-value semantics on an entry point" bugs (e.g. #11855 multiple depth outputs; broader umbrella #6319), the front-end gap is structural, not a missing special case:

- `validateEntryPoint` in `source/slang/slang-check-shader.cpp:1747-1797` calls `validateSystemValueSemantic()` ONCE PER PARAMETER (and once for the return type at :1790), each validating a single semantic in isolation. There is NO pass that aggregates semantics across the whole entry point, so "two depth outputs", "duplicate SV_Target", etc. are never detected at check time. The fix for any such bug is to ADD an aggregation step after that per-param loop (~:1787), not to patch a per-param check.
- The GLSL emitter documents an UNENFORCED invariant the bug violates: `source/slang/slang-emit-glsl.cpp:1651-1655` literally says "an entry point carries at most one directional depth qualifier … the producer deduplicates the decoration, so the two branches here are mutually exclusive (emitting both would redeclare gl_FragDepth twice — invalid GLSL)." Nothing in the front-end guarantees this. Pattern: a comment asserting an invariant whose producer doesn't enforce it = root-cause smell; fix at the producer (front-end), not the emitter.
- Multiple depth semantics is TARGET-AGNOSTIC misbehavior: `-target glsl` emits a single `layout(depth_greater) gl_FragDepth` that the plain `SV_Depth` write silently inherits; `-target spirv` drops the directional `DepthGreater` (conflict-collapse in `slang-emit-spirv.cpp:5941-5975`, ~:5959), emitting only `DepthReplacing`. Both EXIT 0 with no diagnostic. So the correct fix is ONE front-end diagnostic, not per-emitter patches.
- Diagnostics are now defined in `source/slang/slang-diagnostics.lua` — the old `slang-diagnostic-defs.h` was REMOVED (see comment in slang-diagnostics.h:28-29). To add a diagnostic, add `err("name", <code>, "message")` there; mirror `err("duplicate-targets", 50, ...)` at :303.
- Label nuance: a diagnostic that rejects previously-accepted code is technically a language breaking change, but when that code was already producing semantically-wrong output it's "misuse was never valid" (cf. #6216, where the maintainer reverted the breaking-change label). Flag it; let the maintainer decide — don't set the label unilaterally.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782860967918-slang-validateentrypoint-validates-sv-semantics-pe.md`_
