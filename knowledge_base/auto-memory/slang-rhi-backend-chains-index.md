---
name: slang-rhi-backend-chains-index
description: LIVE chains — slang-rhi + backend-codegen (Metal/CUDA/HLSL-SPIRV). Most rows were spilled from MEMORY.md 2026-08-04 (3rd spill) and are gated on a NAMED human; the "added directly" section at top may hold rows where OUR step is pending (currently #12349). Each keeps its RESUME trigger verbatim.
metadata: 
  node_type: memory
  type: index
  title: Slang RHI / backend-codegen live chains
  tags: 
    - slang
    - slang-rhi
    - metal
    - cuda
    - live-chain
    - spillover
  originSessionId: 7c60dd16-8d5c-4bb3-b934-5056a88a40a4
---

# Slang RHI / backend-codegen live chains

Spilled from `MEMORY.md` on 2026-08-04 at the index floor, under the standing
rule that **the only real lever at the floor is spillover, not deletion**. These
are **LIVE** rows, not parked ones — each is gated on a named human, which is
why they were the lowest-priority live rows to move rather than the least true.

⚠️**Rows here retain full force.** A row's presence in a child file is about
index bytes, never about its status. Re-read the linked memo before acting on
any of them — a stale alarm outlives the thing it alarms about.

## Rows added directly here (not spilled)

- 🔵**[#12349 Vulkan PB dropped from pipeline layout](project_slang_12349_vulkan_pb_pushconstant_pipeline_layout.md)** — **LIVE, OUR STEP PENDING** (unlike the spilled rows below, which are all gated on a named human). Root cause in **slang-rhi**, not the compiler: a **PushConstant-only** reflected set mints a phantom `DescriptorSetInfo` with an EMPTY `VkDescriptorSetLayout`, and **insertion-order** set indexing pushes the `ParameterBlock`'s real set to `pSetLayouts[1]` while SPIR-V says set 0. Triage ✅closed (cmt `5185094751`, edited in place ×2 — ⭐**`created_at`≠`updated_at` is the proof, NOT count-of-1**); `slang-fixer` 🔵active on an **L40S**. ⚠️**NOBODY HAS OBSERVED THE VUID — mechanism=source analysis, runtime=PREDICTION** corroborated only by the reporter. A-vs-B **unsettled**: a maintainer argued for ~B on [slang#10959](https://github.com/shader-slang/slang/issues/10959#issuecomment-4334019960) (same mismatch, different trigger), but rhi#676's **raygen-only carve-out** is precedent for A. ⛔**my "#8958 resurfacing" framing was WRONG** — same class, distinct mechanism. **RESUME:** fixer reports (I own the onward hop) / fixer's #676-or-`:406` read **diverges** ⇒ back to triage (⚠️**I told the fixer triage's answer, so agreement confirms FRAMING not the diff — only divergence informs**) / rhi fix lands ⇒ triage refreshes `5185094751` / fresh human comment. ⚠️**CLA "gate" — [TWO identities named `nv-slang-bot`](feedback_two_nv_slang_bot_identities_cla_gate.md): commits by User `286953280` sit `license/cla=pending`; App `274397474` passes. Check EVERY commit's `author.id`, not `[0]`. 🔴NOT a merge block — `enforcement_level=non_admins` (read it: `branches/{default}` `.protection…`), and rhi#808 MERGED with CLA pending. Fix = re-author the commits (`--reset-author` with the App identity); ⛔never suggest merging past a compliance check.**

## Rows relocated from MEMORY.md (2026-08-04, 3rd spill)

- [rhi#803 CPU ray query](project_slang_rhi_803_cpu_ray_query.md) — ABSTAIN_POLICY size-cap (**3,391** LOC >2000) ⇒ HELD. ⭐**re-test the cap on the NEW TOTAL, not the delta.** 🔴**skallweitNV REJECTED the submodule, wants FetchContent** — only in `issues/803/comments` ([endpoint-split](feedback_inbound_scan_must_cover_issue_comments_not_just_reviews.md)). **RESUME v3 in child** (v1 never fired, v2 always fires — same 3-part fix as #12110; discriminator = **ADDRESSEE**, the 16:50Z blocker opens `@WeakKnight`): **a reviewer APPROVES #12282 → it merges** / APPROVES #803 / FetchContent lands / <2000. ⏱️CI settled green 08-04 ⇒ **timestamp or re-probe every observation.**
- 🔴**Apple6/residency polarity** (merged rhi#800/#801): CI runs the **FALLBACK**; ❌never cite `SLANG_RHI_METAL_NO_RESIDENCY_SET` — `/workspace/shared/CANONICAL-ENV-FACTS.md`
- [#10842 Metal DescHandle / rhi#802](project_10842_metal_descriptorhandle_runtime.md) — NOT approved-to-merge; #12096 HOLD, jkwak owns. All 3 hypotheses incl. mine WRONG; ZERO executed bindless coverage. RESUME=maintainer. ⭐ask if a PR's code is even IN the artifact
- ⭐**[#9636 `ref` accessor ⇒ invalid HLSL+SPIRV](project_9636_ref_accessor_invalid_code.md)** — 08-04: **policy-gated (zangold-nv), no fixer, ✅ARTIFACT POSTED `5179137910`**. ⛔**"P3" RETRACTED — repo has NO priority labels (82 enumerated, 0 match); jkwak-work said it in a COMMENT on SIBLING #10174, never applied, never on #9636 ⇒ read priority from labels/issueType, never a sibling's prose.** ⛔**my `[mutating]` hypothesis REFUTED — TWO defects: (i) `Ptr<T>`+SPIRV call/callee mismatch, common to ALL variants ⇒ NOT the `this` mode; (ii) by-value-`this` real but MASKED.** ⭐⭐**a nightly test PASSES OVER A BROKEN ARTIFACT** (hlsl=0, dxil/spirv=255) — **08-04 same defect from the emit side: `-target hlsl` EXITS 0 with NO diagnostic, emitting `Test_prop_ref_0(obj_0) = ...` (call result not assignable); fails only once DXC runs ⇒ THAT silent path IS the live `Missing Diagnostic`. SPIR-V: callee returns `%int`, call site expects `%_ptr_Function_int` (ref-ness survives at call site, dropped from callee sig). Only `tests/diagnostics/subscript-accessor-reference.slang` mentions `ref()` and it tests NAME LOOKUP only ⇒ nothing in-tree catches either.** ⚠️the obvious `isFromCoreModule` gate BREAKS THE BUILD. ⭐**SIGPIPE from `| head` forged an exit code ⇒ measure exits with NO pipe.** RESUME=maintainer rules on the policy.
- ⭐**[#9736 CUDA atomic collision + external-linkage `__device__` funcs](project_9736_cuda_atomic_conflict_nonstatic_device_funcs.md)** — P2, ✅**MEASURED w/ nvcc 12.6 + POSTED cmt `5176126183`**. ⭐**REFRAME: `-target cuh` ALREADY SHIPS ⇒ UNFINISHED, not missing; TWO shapes ALREADY LINK.** ⭐⭐**internal linkage is NECESSARY BUT NOT SUFFICIENT** (exported funcs still collide). ⛔**2 of my claims WRONG** ⇒ [capability negatives need a SEARCH](feedback_capability_negative_needs_a_search_not_two_guesses.md). Rec **(b)**; ⭐`SLANG_PRELUDE_NAMESPACE` precedent de-risks (a). ⚠️child holds all measurements/ids. RESUME=**maintainer** (a)/(b)/(c) call
