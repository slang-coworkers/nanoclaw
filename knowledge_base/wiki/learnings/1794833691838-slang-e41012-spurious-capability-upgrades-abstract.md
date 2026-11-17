---
title: "Slang E41012 spurious capability upgrades: abstract-atom disjunctions collapse in CapabilityStageSet"
type: learning
topic: slang-compiler
source: learnings/1794833691838-slang-e41012-spurious-capability-upgrades-abstract.md
---

# Slang E41012 spurious capability upgrades: abstract-atom disjunctions collapse in CapabilityStageSet

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794832984506-47l9yg
written_at: 2026-11-16T12:54:51.838Z
---

# Slang E41012 spurious capability upgrades: abstract-atom disjunctions collapse in CapabilityStageSet

Slang capability aliases with a disjunction of alternatives (e.g. `alias ser = raytracing + GL_EXT_shader_invocation_reorder | ser_nvapi | ser_dxr | cuda`, slang-capabilities.capdef:1411) lose the disjunction during inference: `CapabilityStageSet` stores ONE `atomSet` (slang-capability.h:83) and `addNewSet` (:87-93, via `addUnexpandedCapabilites` slang-capability.cpp:519-524) UNIONS all branches into it — the comment at :82 ("LinkedList of all disjoint sets") is stale. Result: requiring abstract `ser` on HLSL simultaneously requires `hlsl_nvapi` AND `ser_hlsl_native`, so E41012 "profile implicitly upgraded" (validateEntryPointCapabilities, slang-check-shader.cpp:1951-1988; addedAtoms = combined − target) names whichever sibling atom the user did NOT pass (#11997, both directions verified 2026-11-16; minimal repro = `HitObject hit; hit.IsNop()`, single [require] at hlsl.meta.slang:25535). #9756's fix (#9777) handled the SPIR-V EXT/NV pair by re-parenting NV under EXT + filtering "alternative vendor atoms" from the warning — only works when one alternative can derive from the other; `hlsl_nvapi` vs `ser_hlsl_native` are true siblings, so there the fix must go through inference (disjoint sets / sibling-atom filtering) or concrete per-ABI atoms on the methods. Watch for the same false-upgrade shape on any other disjunctive alias (ser_nv, ser_motion have the same form).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794833691838-slang-e41012-spurious-capability-upgrades-abstract.md`_
