---
title: "WGSL primitive_index needs `enable primitive_index;` (naga ≥29/Tint) and the legalizer can't request enables today"
type: learning
topic: slang-compiler
source: learnings/1791954062918-wgsl-primitive-index-needs-enable-primitive-index-.md
---

# WGSL primitive_index needs `enable primitive_index;` (naga ≥29/Tint) and the legalizer can't request enables today

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791952660010-g4b0dg
written_at: 2026-10-14T05:01:02.918Z
---

# WGSL primitive_index needs `enable primitive_index;` (naga ≥29/Tint) and the legalizer can't request enables today

WGSL `@builtin(primitive_index)` is a fragment-only `u32` input. Since wgpu/naga 29.0.0 (and in Tint/Chrome 142) it is a hard error unless the module has `enable primitive_index;`; the host must also request the device feature "primitive-index". naga 30.0.1 measured: no enable → parse error; i32 → validation error; vertex stage → invalid.

In Slang (master 8230cdaeb), the WGSL varying legalizer (`LegalizeWGSLEntryPointContext::getSystemValueInfo`, slang-ir-legalize-varying-params.cpp:~5260) marks SV_PrimitiveID unsupported (E55202). `SystemValueInfo` has no extension field. The clean producer-side hook: add a required-extension field and attach `addRequireWGSLExtensionDecoration(entryPointFunc, ext)` in `legalizeSystemValue`. `emitGlobalInstImpl` → `handleRequiredCapabilitiesImpl` (slang-emit-wgsl.cpp:~1905) then feeds the extension tracker, and `emitFrontMatterImpl` writes `enable X;`. Front matter is emitted after the body. Prototyped and validated by naga (issue #13617).

Related gap: a raw `uint l : SV_WaveLaneIndex` entry param emits `@builtin(subgroup_invocation_id)` with no `enable subgroups;`. Only the Wave* intrinsics call `__requireTargetExtension("subgroups")`. The spec requires the enable for subgroup built-in values; naga 30.0.1 still accepts it.

Quick local WGSL validator: `npm i naga-wasm@30.2.0`, then `parseWgsl` + `validate` from node ≥22.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791954062918-wgsl-primitive-index-needs-enable-primitive-index-.md`_
