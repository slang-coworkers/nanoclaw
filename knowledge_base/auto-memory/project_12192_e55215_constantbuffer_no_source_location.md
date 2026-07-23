---
name: project-12192-e55215-constantbuffer-no-source-location
description: "#12192 E55215 ConstantBuffer DescHandle no source-loc under spvBindlessTextureNV — P3 PARKED, blocked on #12186"
metadata: 
  node_type: memory
  type: project
  originSessionId: e9890b07-f14d-40cc-a265-9b3dcfd802ee
---

# #12192 — spvBindlessTextureNV: E55215 for ConstantBuffer DescriptorHandle has no valid source location

**Status:** PARKED (P3 / low, diagnostics-quality). Triaged 2026-07-22, HEAD 4955b21c3. Labels: Diagnostics, spirv_vulkan.
Bot-generated follow-up (nv-slang-bot) from the **#12186** review; endorsed by **pdeayton-nv**. Sibling of [[project-12191-e55215-postopkill-deadcode]].

**The bug:** under `-target spirv -capability spvBindlessTextureNV`, the E55215 "unsupported DescriptorHandle conversion" diagnostic for a `ConstantBuffer<T>.Handle` prints with **no source location** (span `0 0 0 0`, no caret). StructuredBuffer/ByteAddressBuffer emit the SAME diagnostic WITH a real `line:col` use-site span. Asymmetry is the defect.

**Hard dependency / ordering (CONFIRMED by reading):** E55215 does NOT exist on master — it is introduced by **PR #12186** (fix for #12185), which is non-draft/in maintainer review but **NOT merged**. On master the same input aborts via `SLANG_UNEXPECTED` at slang-emit-spirv.cpp:5145. So the *symptom* manifests only once #12186 lands; the *root-cause IR shape* is pre-existing. **Fix cannot be tested until #12186 exists.** Recommend fold-into-#12186 OR follow-up-that-lands-after — pdeayton's call.

**Root cause (confirmed):** frontend DOES stamp locs (slang-lower-to-ir.cpp:5133). ConstantBuffer's `.v` access is RE-SYNTHESIZED loc-lessly in a later pass — `slang-ir-lower-buffer-element-type.cpp` `materializeStorageToLogicalCastsImpl` (:1940) + `traverseUses` bodies (:2035-2048, :2272-2305) call `setInsertBefore`+`emitFieldAddress`/`emitLoad` with NO sourceLoc propagation. SB's scalar `StructuredBufferLoad` is never re-synthesized → keeps its loc. So `findFirstUseLoc(cast)` finds a loc-carrying use for SB but only loc-less synthesized insts for CB. Sibling EXT path `processConstantBufferDescriptorHeapLoad` (slang-ir-spirv-legalize.cpp:1300) has the same defect class.

**Recommended fix — Approach A (producer-side):** wrap the `traverseUses` synthesis in `IRBuilderSourceLocRAII(builder, user->sourceLoc)` (or copy `user->sourceLoc` onto new insts) so rebuilt field-address/load inherit the `.v`-access loc; mirror in slang-ir-spirv-legalize.cpp:1300. Optionally hybrid C: also harden E55215 fallback with `getDiagnosticPos` (slang-ir.cpp:18) so no diagnostic ever prints `0 0 0 0`. Regression test: extend `tests/language-feature/descriptor-handle/desc-handle-default.slang -DUNIFORM_BUFFER` to assert CB diagnostic carries a non-`0 0 0 0` span. Fix-class precedent: #11395/#11424 (but there the loc-less inst was in the consumer post-deserialize → emission-side fix; here it's freshly synthesized in a pass we own → producer-side is correct).

**Resume trigger:** #12186 merges → fixer picks up (fold-vs-follow-up per pdeayton). Until then, watch-only.

**GH observability:** CONFIRMED live — triage verdict posted (auth recovered mid-session) at issue comment 5052648390 (PATCHED in place to parked disposition; was briefly "handed to fixer"). Type=Bug set; labels Diagnostics/spirv_vulkan. Full public footprint. Fixer stood down (memo as context only; explicit no-work note). Chain held on #12186 merge.
