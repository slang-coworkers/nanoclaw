---
title: "[approver/confirmed-safe] SER SPIR-V 1.4 fix (12115) — capdef floor + PSB OpExtension both present = the correct two-part fix; recall precedent held"
type: learning
topic: slang-compiler
source: learnings/1784139502358-approver-confirmed-safe-ser-spir-v-1-4-fix-12115-c.md
---

# [approver/confirmed-safe] SER SPIR-V 1.4 fix (12115) — capdef floor + PSB OpExtension both present = the correct two-part fix; recall precedent held

**PR:** shader-slang/slang#12115 "Allow shader invocation reorder extensions with SPIR-V 1.4" (fixes #12097), bot-authored fix/issue-12097. Decision: WOULD_APPROVE (CLEAN) @ R3 36d187dd53d7. Human szihs APPROVED same head = agreement.

**Why it's a transferable confirmation, not just a pass:** The Step-0 recall surfaced the slang#12097 learning that a **capdef floor edit alone is a known-incomplete fix** — lowering `SPV_EXT_shader_invocation_reorder : _spirv_1_5 → _spirv_1_4` makes SER *available* at 1.4 but the module still FAILS spirv-val unless the emitter also declares `SPV_KHR_physical_storage_buffer` (SER's normative 1.4 dependency; physical_storage_buffer is core only from 1.5). This PR is the concrete case: it does BOTH — capdef floor + `ensureExtensionDeclaration("SPV_KHR_physical_storage_buffer")` centralized in `requireSPIRVCapability` (slang-emit-spirv.cpp), guarded by `ensureExtensionDeclarationBeforeSpv15` (effective version < 1.5). The recall precedent was exactly right and the check paid off.

**What made it safe (the challenger checklist for capability-floor PRs):**
1. **Version-floor no-regression:** any capdef atom added to the dependency must have floor ≤ the target version, else it re-introduces the upgrade the PR removes. `SPV_KHR_physical_storage_buffer : _spirv_1_3` (≤1.4). `determineSpirvVersion()` takes `Math::Max` over required `_spirv_*` atoms (slang-ir-spirv-legalize.h) → effective stays 1.4. VERIFY the added atom's floor at head, don't assume.
2. **No generic atom→OpExtension emitter exists** in slang-emit-spirv.cpp — a capdef atom contributes to version-floor + capability-implication modeling ONLY, not emission. So a capdef atom's spelling (SPV_EXT vs SPV_KHR) does NOT itself reach output; emission is driven by the emitter's explicit `ensureExtensionDeclaration(<string>)`. (This is why the maintainer's "just use the capability system" suggestion is necessary-but-not-sufficient — the author correctly explained the capdef alone can't emit the OpExtension.)
3. **Effective-version guard, not profile:** `ensureExtensionDeclarationBeforeSpv15` reads `m_spvVersion` (the computed effective version), so `-profile spirv_1_5/1_6` emit no spurious PSB ext. Confirmed by the tests' `NV15/EXT15-NOT: OpExtension "SPV_KHR_physical_storage_buffer"` lines.
4. **Idempotency:** `ensureExtensionDeclaration` (slang-emit-spirv.cpp:1810) is guarded by `m_extensionInsts.tryGetValue`, so duplicate declarations from spirv_asm + C++ paths dedupe (kills the recurring Devin "duplicate OpExtension" info note).
5. **Memory model unchanged:** it's a plain OpExtension, not `requirePhysicalStorageAddressing()` — stays `Logical GLSL450` (verified by test filecheck).

**Apply to:** any capdef floor/dependency edit or new SPV_* atom for an extension. Confirm both halves (availability model AND actual OpExtension emission), verify the added atom's version floor at head, and require the PR to ship the spirv-val test that compiles a binary module (`-target spirv` under SLANG_RUN_SPIRV_VALIDATION=1), not just `-target spirv-asm`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784139502358-approver-confirmed-safe-ser-spir-v-1-4-fix-12115-c.md`_
