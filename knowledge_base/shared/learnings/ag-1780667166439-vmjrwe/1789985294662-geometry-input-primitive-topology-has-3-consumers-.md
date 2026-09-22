---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789981103194-ylyhfg
written_at: 2026-09-21T10:08:14.662Z
---

# Geometry input primitive topology has 3 consumers / 2 homes; empty input struct erases the param before glsl-legalize lifts it

**Context:** shader-slang/slang#13193 — a geometry shader with an EMPTY input element struct (`struct Input {}` used as `point Input v[1]`) emitted `OpExecutionMode ... Triangles` instead of the declared `InputPoints`/`InputLines` (SPIR-V + GLSL). PR #13195.

**Root cause chain (reusable):**
- The input primitive topology (`point`/`line`/`triangle`/…) is lowered onto the input **IRParam** by `addVarDecorations` (slang-lower-to-ir.cpp), as `IRGeometryInputPrimitiveTypeDecoration`.
- An **empty struct legalizes to `LegalType::none`**, and `legalizeResourceTypes` (impl in slang-ir-legalize-types.cpp, invoked from slang-emit.cpp) **erases that param** — this runs BEFORE `legalizeEntryPointParameterForGLSL` (slang-ir-glsl-legalize.cpp:~4044) would lift the decoration param→func.
- With the param gone, the lift never runs, and the post-loop default in `legalizeEntryPointsForGLSL` (~:4962) stamps `Triangles`. Silent miscompile.

**Key structural fact — 3 consumers, 2 homes:**
- **SPIR-V** emit reads it from the **func** (slang-emit-spirv.cpp:~6584, inside the `StreamOutputTypeDecoration` handler iterating `decoration->getParent()->getDecorations()`).
- **GLSL** emit reads it from the **func** (slang-emit-glsl.cpp:~1600).
- **HLSL** emit reads it from the **PARAM** (slang-emit-hlsl.cpp:~2437) — it emits the topology as a parameter qualifier and uses the decoration to identify WHICH param to prefix.
- So a fix must keep the func copy (for SPIR-V/GLSL) AND the param copy (for HLSL). A blind "MOVE" that removes the param copy regresses HLSL.

**Fix pattern:** record the decoration on the **entry-point IRFunc at lowering** (right after the func-attribute loop that sets [maxvertexcount]/[instance] — topology is an entry-point property), keep the param copy, and make the glsl-legalize param→func lift **idempotent** (assert op-consistency instead of `SLANG_UNEXPECTED`; mirrors the `IRStreamOutputTypeDecoration` handling right below it). Note the glsl-legalize lift never removed the param copy, so both param+func are decorated transiently in the working non-empty case — assert-consistency is the natural idempotency shape.

**Test note:** a Slang build WITHOUT LLVM has no FileCheck, so `//TEST:SIMPLE(filecheck=...)` subtests are reported **Ignored** (not passed/failed) — including pre-existing ones. Verify locally via ground-truth emitted SPIR-V/GLSL (`slangc -target spirv-asm` / `-target glsl`), and rely on CI (which has LLVM) to run the directives. Wildcard the `OpExecutionMode` entry-point operand (`{{.*}}`) — via-glsl renames the entry point.
