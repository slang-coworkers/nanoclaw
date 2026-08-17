---
title: "Diagnostic no-loc on ConstantBuffer descriptor-handle: loc dropped by std140 re-synthesis, not frontend"
type: learning
topic: misc
source: learnings/1784762842417-diagnostic-no-loc-on-constantbuffer-descriptor-han.md
---

# Diagnostic no-loc on ConstantBuffer descriptor-handle: loc dropped by std140 re-synthesis, not frontend

**Issue #12192** (follow-up to #12185/#12186): under `spvBindlessTextureNV`, the E55215 "unsupported DescriptorHandle conversion" diagnostic on a `ConstantBuffer<T>.Handle` has NO source location (machine span `0 0 0 0`), while the identical diagnostic on `StructuredBuffer`/`ByteAddressBuffer` DOES report a real `line:col`.

**Root cause (confirmed by source-read @HEAD 4955b21c3):** The front-end DOES stamp the loc on the `(*cb).v` access (`slang-lower-to-ir.cpp:5133`, `IRBuilderSourceLocRAII(..., expr->loc)`). It is dropped LATER: the ConstantBuffer element is wrapped into a std140 block-struct and its field access is **re-synthesized** in `slang-ir-lower-buffer-element-type.cpp` (`materializeStorageToLogicalCastsImpl` ~:1940; `traverseUses` bodies at :2035/:2272 call `builder.setInsertBefore(user)` + `emitFieldAddress`/`emitLoad`/`emitElementAddress` with NO sourceLoc propagation — no `IRBuilderSourceLocRAII`, no `cloneWithSourceLocPreserved`). A StructuredBuffer scalar load is NOT re-synthesized this way, so it keeps its front-end loc. Net: `findFirstUseLoc(cast)` (slang-ir-util.cpp:429) finds a loc-carrying use for the buffer cases but only loc-less synthesized insts for CB. Sibling `spvDescriptorHeapEXT` path has the same defect at `slang-ir-spirv-legalize.cpp:1300` (`processConstantBufferDescriptorHeapLoad` → `emitLoadDescriptorFromHeap` without copying `loadInst->sourceLoc`).

**Lesson / method:** When a diagnostic prints with no `file:line` but the front-end clearly stamped the loc, suspect a later IR pass that RE-SYNTHESIZES the affected access (block-struct wrapping, std140 packing, type legalization) via `setInsertBefore(user)`+`emitXxx` without propagating loc. Contrast with #11395/#11424 (learning 1780418999087): there the loc-less inst lived in the CONSUMER post-deserialize, so the fix went to the emission site (`findFirstUseLoc` fallback). Here the loc-less insts are freshly synthesized in a pass WE own → the principled fix is producer-side loc propagation, not a diagnostic-side band-aid. Decision rule: fix at emission only when you can't reach the producer; propagate at the producer when you own the synthesizing pass.

**Ordering gotcha:** E55215 itself is introduced by PR #12186 (unmerged); on master the same input aborts with E99997 at `slang-emit-spirv.cpp:5145`. So the SYMPTOM needs #12186's branch to reproduce, but the root-cause IR shape (loc-less CB cast) is already on master. Fold the fix into #12186 or ship after it — don't open a rival branch off master.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784762842417-diagnostic-no-loc-on-constantbuffer-descriptor-han.md`_
