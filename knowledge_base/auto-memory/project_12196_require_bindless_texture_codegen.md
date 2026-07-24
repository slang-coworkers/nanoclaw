---
name: project_12196_require_bindless_texture_codegen
description: "#12196 entry-point [require(spvBindlessTextureNV)] not honored in DescriptorHandle SPIR-V codegen — deferred bindless half of #11631; design-gated, PARKED at triaged"
metadata: 
  node_type: memory
  type: project
  originSessionId: 355913ad-3f78-42cd-8e45-ed9de7f6273b
---

# #12196 — Honor entry-point `[require(spvBindlessTextureNV)]` in DescriptorHandle SPIR-V codegen

Self-authored tracking issue (nv-slang-bot) for the **deferred bindless half of [[project_11631_entrypoint_require_spirv_codegen]]**. #11633 fixed only the SPIR-V *version* half; bindless half left untouched by design.

**Root mechanism (triager code-trace @ master 56eb1aa08, no empirical build):** `specializeTargetSwitch` (`slang-ir-specialize-target-switch.cpp:41`) resolves the `getDescriptorFromHandle` `__target_switch` from GLOBAL `target->getTargetCaps()` only, at module-link scope (`slang-ir-link.cpp:2425`) before SPIR-V emit. Entry-point `[require]` lowers to `IRRequireCapabilityAtomDecoration` (`slang-lower-to-ir.cpp:15257`) never unioned into that set → heap accessor unless `-capability spvBindlessTextureNV` passed on CLI.

**Classification:** enhancement / design-gated · medium · IR (capability+specialization) + SPIR-V emit · P2. No `reproduced` label. Issue Type blank (straddles bug/feature/design).

**Two parts, both maintainer-owned (csyonghe / tangent-vector / jkwak-work / pdeayton-nv):**
- **(A) make-it-work:** requirement must reach the cap set `specializeTargetSwitch` consumes. Principled path = per-entry-point reachability specialization of the shared callee (Slang has `specializeIRForEntryPoint` in linkIR) + csyonghe's conflict→error rule (entry-pt vs entry-pt, or source `[require]` vs `-capability`). Doing it in later SPIR-V/emit passes is insufficient AND harmful → incoherent SPIR-V / guarded VectorDCE crash.
- **(B) UX:** silent-accept-and-ignore today. warn vs match-master. tangent-vector cautioned against a `[require]`-conditional diagnostic (bad mental model).

**Three HEAD corrections triager flagged to the write-up:** switch actually lives in `defaultGetDescriptorFromHandle` (extern `getDescriptorFromHandle` wraps it); coherence guard test `tests/spirv/entrypoint-require-bindless-texture-in-buffer.slang` is NOT on master (only #11633 draft branch); #11633 (version half) is still a DRAFT PR, not merged.

**State:** PARKED at triaged. Verdict comment https://github.com/shader-slang/slang/issues/12196#issuecomment-5054501023. NOT forwarded to slang-fixer — no fix actionable until maintainer design decision. Resume trigger = maintainer comment deciding (A)/(B). Related bindless bug (distinct): [[project_12185_bindless_texture_nv_desc_handle_nonimage]].
