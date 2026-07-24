---
name: project-12192-e55215-constantbuffer-no-source-location
description: "#12192 E55215 ConstantBuffer DescHandle no source-loc under spvBindlessTextureNV — P3 PARKED, blocked on #12186"
metadata: 
  node_type: memory
  type: project
  originSessionId: e9890b07-f14d-40cc-a265-9b3dcfd802ee
---

# #12192 — spvBindlessTextureNV: E55215 for ConstantBuffer DescriptorHandle has no valid source location

**Status:** ACTIVE (re-opened 2026-07-23 by maintainer). Was PARKED (P3/diagnostics-quality) after triage 2026-07-22, HEAD 4955b21c3. Labels: Diagnostics, spirv_vulkan.
Bot-generated follow-up (nv-slang-bot) from the **#12186** review; endorsed by **pdeayton-nv**. Sibling of [[project-12191-e55215-postopkill-deadcode]].

**RE-OPEN (07-23, pdeayton-nv cmt 5053984795):** #12186 blocker LIFTED. Maintainer: "this issue is intended to be a **general fix for preserving source locations through ConstantBuffer lowering**, so you can begin work on it now before 12186 lands. There should be **other reproducing cases you can find**." → scope is general CB source-loc preservation (not just the E55215-under-spvBindlessTextureNV symptom).

**MATERIAL FINDING (07-23, triager @ master HEAD 56eb1aa08 — independently source-read + fresh Debug build + re-ran, did NOT take subagent's word):** the master repro pdeayton expected is NOT cleanly there. IR loc-drop is REAL (`_maybeSetSourceLoc` slang-ir.cpp:1825 pulls from builder's loc *stack*, not the `setInsertBefore(user)` anchor → new CB insts at :2035/:2272 get empty sourceLoc) — BUT it is **masked on master** by statement-granularity `OpLine`/`DebugLine`: every statement has some loc-carrying inst, so the block gets a correct statement-level OpLine covering the loc-less CB access. No CB-specific asymmetry under `-g2`/`-g1`; forced CB-through-control-flow diagnostic compiled clean. The only clean user-visible symptom is **E55215** (a direct `inst->sourceLoc` consumer), which exists only on #12186's branch. So `reproduced`-on-master label CANNOT be honestly applied. Fix (Approach A) still correct as general hygiene.

**DECISION (orch → triager, 07-23):** Option 3 — surface the finding to pdeayton (fresh comment, his human comment is newest → fresh-not-edit for @-mention notify), state IR-drop confirmed but masked-on-master by OpLine granularity, recommend proceeding as general source-loc-hygiene (regression = `-g2` before/after golden the fix demonstrably changes) absent a specific repro he has in mind; ask confirm-or-redirect. NO `reproduced` label. **Fixer handoff HELD** until pdeayton replies (his answer shapes the regression test: specific repro vs. -g2 delta). Approach A settled → immediate handoff on his confirm. GitHub reply owned by triager (real @nv-slang-bot mention → posting authorized).

**EXECUTED (07-23):** clarifying question posted to pdeayton = fresh comment **5054159599** (@-mentions him; IR-drop confirmed real, masked-on-master by OpLine granularity, only clean symptom E55215 on #12186 branch; asks (a) specific master repro vs (b) proceed general source-loc hygiene w/ -g2 before/after golden + E55215-post-#12186 as tests, `reproduced` skipped). Stale parked comment **5052648390** edited-in-place with "superseded → see [new comment]" pointer. NO `reproduced` label. **State = awaiting-maintainer; fixer HELD.** Resume: pdeayton replies → reproduce his case OR immediate Approach-A handoff to slang-fixer (fix settled, no re-litigation). If pdeayton quiet >1–2 days → triager pings orch → proceed on general-hygiene framing rather than stall.

**The bug:** under `-target spirv -capability spvBindlessTextureNV`, the E55215 "unsupported DescriptorHandle conversion" diagnostic for a `ConstantBuffer<T>.Handle` prints with **no source location** (span `0 0 0 0`, no caret). StructuredBuffer/ByteAddressBuffer emit the SAME diagnostic WITH a real `line:col` use-site span. Asymmetry is the defect.

**Hard dependency / ordering (CONFIRMED by reading):** E55215 does NOT exist on master — it is introduced by **PR #12186** (fix for #12185), which is non-draft/in maintainer review but **NOT merged**. On master the same input aborts via `SLANG_UNEXPECTED` at slang-emit-spirv.cpp:5145. So the *symptom* manifests only once #12186 lands; the *root-cause IR shape* is pre-existing. **Fix cannot be tested until #12186 exists.** Recommend fold-into-#12186 OR follow-up-that-lands-after — pdeayton's call.

**Root cause (confirmed):** frontend DOES stamp locs (slang-lower-to-ir.cpp:5133). ConstantBuffer's `.v` access is RE-SYNTHESIZED loc-lessly in a later pass — `slang-ir-lower-buffer-element-type.cpp` `materializeStorageToLogicalCastsImpl` (:1940) + `traverseUses` bodies (:2035-2048, :2272-2305) call `setInsertBefore`+`emitFieldAddress`/`emitLoad` with NO sourceLoc propagation. SB's scalar `StructuredBufferLoad` is never re-synthesized → keeps its loc. So `findFirstUseLoc(cast)` finds a loc-carrying use for SB but only loc-less synthesized insts for CB. Sibling EXT path `processConstantBufferDescriptorHeapLoad` (slang-ir-spirv-legalize.cpp:1300) has the same defect class.

**Recommended fix — Approach A (producer-side):** wrap the `traverseUses` synthesis in `IRBuilderSourceLocRAII(builder, user->sourceLoc)` (or copy `user->sourceLoc` onto new insts) so rebuilt field-address/load inherit the `.v`-access loc; mirror in slang-ir-spirv-legalize.cpp:1300. Optionally hybrid C: also harden E55215 fallback with `getDiagnosticPos` (slang-ir.cpp:18) so no diagnostic ever prints `0 0 0 0`. Regression test: extend `tests/language-feature/descriptor-handle/desc-handle-default.slang -DUNIFORM_BUFFER` to assert CB diagnostic carries a non-`0 0 0 0` span. Fix-class precedent: #11395/#11424 (but there the loc-less inst was in the consumer post-deserialize → emission-side fix; here it's freshly synthesized in a pass we own → producer-side is correct).

**Resume trigger:** #12186 merges → fixer picks up (fold-vs-follow-up per pdeayton). Until then, watch-only.

**GH observability:** CONFIRMED live — triage verdict posted (auth recovered mid-session) at issue comment 5052648390 (PATCHED in place to parked disposition; was briefly "handed to fixer"). Type=Bug set; labels Diagnostics/spirv_vulkan. Full public footprint. Fixer stood down (memo as context only; explicit no-work note). Chain held on #12186 merge.
