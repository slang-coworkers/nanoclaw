---
name: project_9400_loadserialized_dep_source_redundant
description: "#9400 loadSerializedModuleContents eager dep-source load — PARKED maintainer redesign"
metadata: 
  node_type: memory
  type: project
  originSessionId: 609b906d-12c8-4353-9b06-8c84ade99c52
---

# #9400 — `Linkage::loadSerializedModuleContents` eagerly loads all dep source

**State (2026-07-21):** TRIAGED → PARKED for maintainer. Author NBickford-NV (NVIDIA).
Enhancement/perf-design / low-medium / component: modules (serialization→linkage→file-dep tracking) / P3.

**Verdict (triager, verified @HEAD 6a244fee2):** Author substantially right. A `.slang-module`
compiles to GLSL fine with original `.slang` source DELETED — from-module compile path does
NOT need dependency source *content*. Loop at `slang-session.cpp:2248-2275` eagerly reads every
dep's full text, but content is dead weight on load:
- digest is chunk-copied (`:2277`)
- UseUpToDateBinaryModule runs its OWN independent RIFF-chunk loop (`:1825-1892`, NOT this list)
- reflection (`slang-module.cpp:312-323`) + module-from-module re-serialize
  (`slang-serialize-container.cpp:310-347`) use dep PATHS only.
- Missing-snippet 36107 symptom is SEPARATE: deserialized SourceViews built from empty-content
  SourceFiles, renderer bails on `!hasContent()` (`slang-serialize-source-loc.cpp:270-277` +
  `slang-diagnostic-sink.cpp:290-293`). NOT the loaded source.

So: full LOAD unnecessary; PATHS must be preserved. Recommended surgical fix (Approach A):
register dep PATHS without materializing content + add missing regression test
(`getDependencyFilePath` on loaded module + module-from-module dep preservation — current suite
has ZERO coverage, which is why "comment it out, tests still pass").

**Why PARKED not dispatched to fixer:** @tangent-vector explicitly asked for a first-principles
REDESIGN of this path/dependency/source-loc subsystem ("not a band-aid"); issue assigned to
@jkwak-work. Maintainer-owned design call.

**GitHub:** triager posted verified 5-bullet (comment 5036919176), applied `reproduced`,
left human-set Type=Bug untouched. Canonical thread `gh-issue-shader-slang/slang-9400`.

**36107 note:** same error code as [[project_12165_fwidth_metal_capability_annotation]] but
UNRELATED root cause — do not conflate.
