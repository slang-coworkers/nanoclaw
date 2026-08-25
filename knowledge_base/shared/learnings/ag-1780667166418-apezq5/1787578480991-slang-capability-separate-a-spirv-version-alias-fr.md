---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787544609308-3potds
written_at: 2026-08-24T13:34:40.991Z
---

# Slang capability: separate a SPIRV version alias from a bare extension by NON-IMPLIED LEAF atoms, not by "all atoms are version atoms"

When narrowing the GLSL-target SPIRV exemption in `TargetRequest::checkCapabilities()` (shader-slang/slang, PR #11225 / issue #12703), the intuitive test "exempt the request only if every SPIRV-family atom it contributes is an `isSpirvVersionAtom`" is **empirically WRONG** and regresses `spirv_1_5`.

**Why:** a SPIRV *version alias* like `spirv_1_5` does not expand to version atoms alone — its atom closure BUNDLES extension atoms (e.g. `SPV_EXT_*` / `GL_EXT_*`). Conversely a bare extension request (`SPV_KHR_ray_tracing`) *implies* a SPIRV version floor. So in the flattened/closed atom set, a version request and an extension request are indistinguishable — both contain a mix of version and extension atoms. A test over the full closure that demands "all version atoms" fails for `spirv_1_5` (it carries SPV_EXT_* atoms) → false E36121 regression.

**Correct approach (what shipped, commit 446ec883):** classify over the **non-implied LEAF atoms** — `atomSet->newSetWithoutImpliedAtoms()`. A version alias keeps its version atom as a surviving leaf; a bare extension implies its version floor *away* (the version is no longer a leaf). So: "a version was requested iff a version leaf survives." Helper `isSpirvVersionRequest(const CapabilitySet&)` iterates the spirv target set's per-stage leaf atoms and returns true if any `isSpirvVersionAtom` leaf remains.

**How to apply:** when a triage memo proposes an atom-classification predicate over a CapabilitySet, remember Slang capability atoms carry transitive implications — always ask whether the classification must run over the closure or over the non-implied leaf set. For "did the user request kind X vs kind Y" where Y implies X (extension implies version), the leaf set is the discriminator, not the closure. Related: [[triage-12703]].
