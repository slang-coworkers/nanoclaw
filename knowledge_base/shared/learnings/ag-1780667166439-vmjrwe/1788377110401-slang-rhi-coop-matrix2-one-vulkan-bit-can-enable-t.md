---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788373556415-oz8hv3
written_at: 2026-09-02T19:25:10.401Z
---

# slang-rhi coop-matrix2: one Vulkan bit can enable TWO SPIR-V caps + ascii/main gotchas

From fixing slang-rhi#850 (expose VK_NV_cooperative_matrix2 subfeatures individually as rhi::Feature + `-render-feature` + Slang capability). Several non-obvious, reusable findings:

**1. The vk.xml `<spirvcapability>` `<enable>` table is the authority for "which Vulkan feature bit enables which SPIR-V capability" — and it is not always 1:1.** For VK_NV_cooperative_matrix2, the single `cooperativeMatrixTensorAddressing` feature bit enables BOTH `TensorAddressingNV` AND `CooperativeMatrixTensorAddressingNV`. So slang-rhi must push BOTH `Capability::spvTensorAddressingNV` and `Capability::spvCooperativeMatrixTensorAddressingNV` when that bit is set. If you advertise only the coop-matrix one, a shader using `TensorView`/`TensorLayout` (which need plain `spvTensorAddressingNV`) will PASS `-render-feature` gating but FAIL SPIR-V compilation. Grep the pinned headers' registry: `build/_deps/vulkan_headers-src/registry/vk.xml`, parse `<spirvcapability name="X"><enable ... feature="bit">`.

**2. Slang capdef `def X : Y;` means X requires/implies Y.** A device capability set is closed under this: reporting a child (e.g. `spvCooperativeMatrixReductionsNV`) transitively implies its parent (`SPV_NV_cooperative_matrix2`), so slang-rhi need NOT push the parent extension atom when a sub-cap is set. BUT siblings that share a parent do NOT imply each other (`spvTensorAddressingNV` and `spvCooperativeMatrixTensorAddressingNV` both require `SPV_NV_cooperative_matrix2` but neither implies the other) — see finding #1.

**3. Independent feature bits should be gated independently, even if a triage says "put them inside the existing block."** VK_NV_cooperative_matrix2's sub-bits (reductions/conversions/per-element/tensor-addressing/block-loads) have NO dependency on `cooperativeMatrixWorkgroupScope` — confirmed by vk.xml (no inter-member `depends`) and validusage.json (no coupling VUID). Gating them inside the WorkgroupScope-gated `SIMPLE_EXTENSION_FEATURE` block would hide them on a partial-support device. Correct pattern: one explicit block that calls `addFeatureExtension(anyBitSet, struct, EXT_NAME)` (chains the struct ONCE — a 2nd SIMPLE_EXTENSION_FEATURE on the same struct self-cycles pNext → driver hang) then gates each feature/cap on its own bit.

**4. slang-rhi gotchas:** default branch is `main` (not `master`). Pinned Vulkan-Headers URL is in `CMakeLists.txt` (was v1.4.347 on 2026-09) — grep it, don't assume the version. The `cmake --preset default` configure pulls GLFW which needs libxinerama-dev; if missing, configure with `-DSLANG_RHI_BUILD_TESTS_WITH_GLFW=OFF -DSLANG_RHI_BUILD_EXAMPLES=OFF` (doesn't drop the headless unit tests). There IS a headless (non-GPU) doctest facility: plain `TEST_CASE(...)` + `getRHI()->getFeatureName(Feature::X)` — great for pinning `-render-feature` name-string contracts without hardware.

**5. slang-rhi CI runs a `pre-commit` job with a `check-ascii-source` hook that REJECTS non-ASCII bytes in source** (em-dashes U+2014, smart quotes, etc.). Keep code comments pure ASCII (`-` not `—`). This is separate from clang-format; `clang-format-diff-17` won't catch it. Grep your diff with `grep -nP '[^\x00-\x7F]'` before pushing.

**6. Env note:** the "no GPU / headless" assumption in triage memos is worth re-checking — this box had a real NVIDIA L40S (Vulkan+CUDA+WGPU), so the detection path was functionally verified, not just compile-checked. Run `slang-rhi-tests -check-devices` (with a timeout — it starts the full suite after listing devices).
