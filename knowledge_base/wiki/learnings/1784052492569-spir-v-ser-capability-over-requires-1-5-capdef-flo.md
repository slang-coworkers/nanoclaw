---
title: "SPIR-V SER capability over-requires 1.5; capdef floor edit alone is insufficient"
type: learning
topic: slang-compiler
source: learnings/1784052492569-spir-v-ser-capability-over-requires-1-5-capdef-flo.md
---

# SPIR-V SER capability over-requires 1.5; capdef floor edit alone is insufficient

**Context:** slang#12097 — `-profile spirv_1_4 -capability spvShaderInvocationReorderNV/EXT` emits a SPIR-V 1.5 header even though the SER extensions are usable at 1.4 (with a physical-storage-buffer extension declared).

**Mechanism (verified @HEAD 3eeda847c):**
- `source/slang/slang-capabilities.capdef:624` `def SPV_EXT_shader_invocation_reorder : _spirv_1_5 + SPV_KHR_ray_tracing;` (NV inherits at `:629`; motion aliases at `:862`/`:867`). The `_spirv_1_5` atom is a deliberate simplification (comment at `:622-623` says so). Requiring any SER capability pulls `_spirv_1_5` into the effective target-capability set.
- `slang-ir-spirv-legalize.cpp:2482` `determineSpirvVersion()` iterates the target atom set; `case CapabilityName::_spirv_1_5 → requireSpirvVersion(0x10500)` raises the running-max effective version. `requireSpirvVersion` (slang-ir-spirv-legalize.h:49) is a max, so the SER requirement is a **floor** — it never downgrades a higher `-profile spirv_1_5/1_6` (those supply their own `_spirv_*` atom).
- Header word written at `slang-emit-spirv.cpp:537` (`m_words.add(m_spvVersion)`).

**Non-obvious gotcha — a capdef `_spirv_1_5`→`_spirv_1_4` edit ALONE does NOT make the 1.4 module valid:** the SER emit path (`slang-emit-spirv.cpp:2745-2762`, in `emitOpTypeHitObject*`) declares only the reorder `OpExtension`/`OpCapability`. The ONLY code that emits `OpExtension "SPV_KHR_physical_storage_buffer"` is `requirePhysicalStorageAddressing()` (`slang-emit-spirv.cpp:2095-2101`), and it fires only when the addressing model becomes `PhysicalStorageBuffer64` (buffer_reference usage) — which a plain SER raygen shader never triggers. So the 1.4 SER path emits no PSB extension → spirv-val fails per the SER extension's normative 1.4 dependency (1.4 + SPV_KHR_ray_tracing + one of {SPV_EXT/KHR_physical_storage_buffer, core 1.5}). The 1.4 path must declare the PSB **extension** without necessarily switching to PhysicalStorageBuffer64 addressing (memory model stays `Logical GLSL450`). `SPV_KHR_physical_storage_buffer` is NOT a capdef atom — only `SPV_EXT_physical_storage_buffer : _spirv_1_3` (`:534`) exists; the KHR spelling is a hardcoded emit string.

**capdef disjunction is available:** `|` expresses "one-of" (e.g. `GL_EXT_buffer_reference = _GL_EXT_buffer_reference | SPV_EXT_physical_storage_buffer` at `:1058`), so the spec's "1.4+PSB OR core-1.5" is modelable as `_spirv_1_4 + SPV_KHR_ray_tracing + (SPV_EXT_physical_storage_buffer | _spirv_1_5)` — but that still needs the emission change, so it's a superset of the minimal fix.

**Sibling issue watch:** #12099 (same author, jkwak-work) proposes the OPPOSITE resolution for the identical repro — *reject* a conflicting `-profile`/`-capability` combo rather than allow the 1.4 downgrade. When triaging one of a paired "allow X" / "reject X" issue set, flag the tension to the maintainer rather than silently picking a side.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784052492569-spir-v-ser-capability-over-requires-1-5-capdef-flo.md`_
