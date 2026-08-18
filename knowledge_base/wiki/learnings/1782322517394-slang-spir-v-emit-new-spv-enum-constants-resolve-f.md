---
title: "Slang SPIR-V emit: new Spv* enum constants resolve from the SPIRV-Headers package, not external/spirv/spirv.h"
type: learning
topic: slang-compiler
source: learnings/1782322517394-slang-spir-v-emit-new-spv-enum-constants-resolve-f.md
---

# Slang SPIR-V emit: new Spv* enum constants resolve from the SPIRV-Headers package, not external/spirv/spirv.h

When reviewing a Slang change that adds an emit reference to a new `SpvCapability*` / `SpvExecutionMode*` constant (e.g. shader-slang/slang#11541 Approach Y added `SpvCapabilityShader64BitIndexingEXT`=5426 and `SpvExecutionModeShader64BitIndexingEXT`=5427), do NOT flag "absent from `external/spirv/spirv.h`" as a build break. That file is a **stale, partial, non-compiled** vendored copy. The emitter `source/slang/slang-emit-spirv.cpp:18` includes `"spirv/unified1/spirv.h"`, which resolves via CMake `find_package(SPIRV-Headers REQUIRED)` (CMakeLists.txt:531) to the pinned SPIRV-Headers package include dir — that package defines the new C constants. Uncast usage like `requireSPIRVCapability(SpvCapabilityShader64BitIndexingEXT)` compiling cleanly is the proof the resolved header has them.

Fast verification path (no build needed): grep the committed grammar tables `external/spirv-tools-generated/core_tables_body.inc` for the symbol — it enumerates both the capability and any execution mode by numeric id (e.g. `5426 … Shader64BitIndexingEXT … SPV_OPERAND_TYPE_CAPABILITY` and `5427 … SPV_OPERAND_TYPE_EXECUTION_MODE`). Presence there is strong evidence the pinned SPIRV-Headers version carries the C enums. (On a worktree the `external/spirv-headers` submodule may be unpopulated, so you can't read its spirv.h directly — the .inc tables are the reliable local check.) Three independent reviewers (correctness A, clarity C) plus me all re-derived this on the same PR; this note short-circuits that.

Corollary: round-1 review correctly DROPPED this as out-of-scope for an atom-only PR (no C++ capability call); it becomes live the moment a PR adds an emitter `requireSPIRVCapability(Spv...)` call — but the answer is still "not a build break," it's a portability note (CI must use a SPIRV-Headers version new enough to carry the constant).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782322517394-slang-spir-v-emit-new-spv-enum-constants-resolve-f.md`_
