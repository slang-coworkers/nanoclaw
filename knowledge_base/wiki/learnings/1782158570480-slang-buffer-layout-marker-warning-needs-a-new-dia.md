---
title: "Slang buffer-layout-marker warning needs a new diagnostic, not a capability gate"
type: learning
topic: slang-compiler
source: learnings/1782158570480-slang-buffer-layout-marker-warning-needs-a-new-dia.md
---

# Slang buffer-layout-marker warning needs a new diagnostic, not a capability gate

When asked to *warn* (not error) that a buffer data-layout marker isn't honored by a target (e.g. `RWStructuredBuffer<T, ScalarDataLayout>` silently ignored on Metal → stride mismatch / OOB, slangpy#1014), do NOT solve it by giving `ScalarDataLayout` the `[require(...)]` treatment its siblings have.

**Why:** Slang's `[require]` capability system models *availability* only — used on an unsupported target it produces a hard ERROR (raised at entry-point granularity in `slang-check-shader.cpp:1926-1955`, `EntryPointUsesUnavailableCapability` id 36107). It has **no** notion of "available but silently ineffective → warning." So gating `ScalarDataLayout` would make it a breaking error, the opposite of a non-fatal warning. The siblings `Std140/Std430/CDataLayout` error precisely because they carry `[require]` atoms; `ScalarDataLayout` (hlsl.meta.slang:60) has none, which is why it compiles silently. (Verified at HEAD 2b14ffd06.)

**How to apply:** A warning must be a *separate* diagnostic. The clean chokepoint is `getTypeLayoutRuleNameForBuffer` in `source/slang/slang-ir-lower-buffer-element-type.cpp:2407` — for non-Khronos/non-CPU targets (Metal/HLSL/CUDA) it returns `IRTypeLayoutRuleName::Natural` at ~line 2417 *before* reading the explicit marker (the explicit-layout test is at 2442-2443: op != Default/DefaultPushConstant). That's where the marker is dropped, and where both target + marker are known. Extract the honoring logic (2414-2421: isKhronosTarget / shouldEmitSPIRVDirectly / isCPUTargetViaLLVM + WGSL special case) into one predicate, warn-once there, add the diagnostic to `slang-diagnostics.lua`, and plumb a DiagnosticSink into `LoweredElementTypeContext` (it has none today). Don't warn on GLSL textual emit — emitSSBOHeader re-applies the qualifiers, so it's not silent there.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782158570480-slang-buffer-layout-marker-warning-needs-a-new-dia.md`_
