---
name: project_12161_nonuniform_descriptorhandle_nonspirv_verify
description: "slang#12161 NonUniform on DescriptorHandle<T> round-trip for non-SPIR-V targets — triaged→HELD awaiting hardware/downstream verification (unproven defect)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8fda4b3e-5543-49c1-97ca-d5ecb7532b51
---

# slang#12161 — NonUniform on DescriptorHandle<T> round-trip, non-SPIR-V targets (HLSL/GLSL/WGSL)

Bot-authored tracking/verification item split off from #12110 / draft PR #12116 (a reviewer flagged it there). Opened 2026-07-20.

**What it tracks (NOT a proven defect):** #12116 restored the `NonUniform` decoration on the `DescriptorHandle<T>` / `ResourceDescriptorHeap[NonUniformResourceIndex(i)]` round-trip for the **direct SPIR-V backend only** (zero non-SPIR-V changes). This issue asks whether the equivalent hint reliably propagates on HLSL/DXC, GLSL/glslang, WGSL.

**Triage verdict (slang-triager, HEAD `6a244fee29`):** triaged → **HELD awaiting hardware/downstream verification**. P3, low sev (would be medium if a real divergent-index gap is confirmed). Component: target-emit textual `floatNonUniformResourceIndex` path.
- Emit shape CONFIRMED at ToT both spellings: HLSL/GLSL land marker *nested* inside `uint2(NonUniformResourceIndex(i),0).x` (not on final scalar index); WGSL emits none (expected — no WebGPU non-uniform qualifier).
- Mechanism: `master`'s `floatNonUniformResourceIndex` switch has NO `MakeVector`/`CastUInt2ToDescriptorHandle` case — those are SPIR-V-only additions in the still-**draft** #12116. Textual mode repositions-not-decorates by design.
- Blocker: decisive DXC/glslang downstream check is impossible GPU-less; `-emit-spirv-via-glsl` won't load `slang-glslang` in that Debug tree.
- Fix-if-confirmed = **Approach A**: mirror #12116 in textual float-mode (reposition wrapper onto emerging scalar index → canonical `resource[NonUniformResourceIndex(i)]`), gated on a failing downstream test. Larger blast radius (all non-SPIR-V targets) than #12116's SPIR-V-only confinement. **Approach B (do nothing)** is leading candidate on current evidence.

**GitHub artifact:** comment [5020712300](https://github.com/shader-slang/slang/issues/12161#issuecomment-5020712300) — nv-slang-bot[bot], 2026-07-20T09:25:57Z. 5-bullet verdict, hedged "defect not proven".

**Chain state:** CLOSED pending external verification. Re-open trigger: a substantive human comment (DXC/glslang hardware result confirming/refuting the gap, or a maintainer design call) → dispatch to slang-triager on thread `gh-issue-shader-slang/slang-12161`. A thanks/ack does not re-open. Depends on [[project_12099_profile_capability_conflict_diag]]-style external-verification pattern; template PR #12116 is itself unmerged draft.
