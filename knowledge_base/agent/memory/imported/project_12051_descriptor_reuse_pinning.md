---
name: project_12051_descriptor_reuse_pinning
title: slang#12051 — re-use loaded descriptors (✅ TERMINAL, merged via #12111)
description: "shader-slang/slang#12051 'Add a way to re-use loaded descriptors multiple times' — ✅ TERMINAL: PR #12111 MERGED 2026-07-21, #12051 auto-closed. Fix marks a UniformConstant resource-ELEMENT load (getPtr op == kIROp_GetElementPtr) movable so existing removeRedundancyInFunc CSE coalesces N descriptor loads → 1 (6→2 in the reporter's repro), SPIR-V element/heap accesses only. Distilled from a 73KB reverse-chronological chain log. Two follow-ups tracked separately: [[project_12120_direct_resource_params_flag]] (live) and [[project_12110_nonuniform_descriptorhandle_fixed_in_1415]]."
metadata:
  node_type: memory
  type: project
  originSessionId: a4546982-e3c1-438d-9b81-9756edcca56a
---

# slang#12051 — re-use loaded descriptors — ✅ TERMINAL (merged 2026-07-21)

**Terminal / historical.** Distilled 2026-09-01 from a 73 KB reverse-chronological chain
log. Reporter maxime-modulopi: `DescriptorHandle<T> → T` re-materializes at every use →
redundant descriptor reload in hot loops (he measured a 2.5% SSR/HiZ win pinning via an
`OpCopyObject` `spirv_asm` workaround). The blow-by-blow review/CI narrative is pruned;
the fix, the design arc, and the durable lessons remain.

## The shipped fix (PR #12111, merge commit `958620c166`)

- `isMovableInst` (slang-ir.cpp) marks a `kIROp_Load` movable when the pointer's
  address-space is `UniformConstant` **AND** `load->getPtr()->getOp() == kIROp_GetElementPtr`
  (an element/heap access, **not** a root scalar global). The existing
  `removeRedundancyInFunc` CSE then coalesces the N redundant descriptor loads → 1
  (6→2 in the reporter's repro).
- **SPIR-V-only by construction:** `AddressSpace::UniformConstant` has a single producer
  site (`slang-ir-spirv-legalize.cpp:518`), and the CSE consumer runs only in
  `simplifyIRForSpirvLegalization` → dead code on HLSL/Metal/CUDA/GLSL/WGSL. No cross-target
  blast radius.
- **Test:** straight-line repeated descriptor uses (no `[ForceUnroll]` — per jkwak; a plain
  non-unrolled loop is the *wrong* no-unroll test because redundancy-removal runs with
  `hoistLoopInvariantInsts=false`, so a loop already has one static in-body load and would
  not exercise coalescing; only straight-line/unrolled shapes do).
- Merged by jkwak-work after genuine dual-maintainer approval (jkwak + csyonghe
  "looks good to me"). `Closes #12051`.

## Design arc (why it took the path it did)

Root cause was mis-modeled twice before landing, each corrected by *measurement*:

1. First framed as IR-level `shouldDuplicateInstAtUseSite` force-dup of
   `CastDescriptorHandleToResource` (slang-ir-util.cpp:2638) — **wrong**; `-dump-ir` showed a
   single shared load, disasm showed 3, so the triplication is introduced at SPIR-V emit, not
   in generic IR.
2. Built as "Layer B" (`loadCache` in SPIR-V-legalize `insertLoadAtLatestLocation`), then
   **maintainer-directed pivot to "Layer A"** (`isMovableInst`) — jkwak/csyonghe preferred
   reusing the generic movable-inst CSE lever over a bespoke cache.
3. The first Layer-A predicate (mark **any** UniformConstant-ptr load movable) **over-fired**
   on plain combined-sampler globals → real regression in `tests/glsl-intrinsic/intrinsic-texture.slang`
   (.6/.7/.8, `-target spirv -O3`), which the approver's CI-investigation caught and BLOCKed.
   Narrowed broad → `getRootAddr(ptr)!=ptr` → `kIROp_GetElementPtr`-only = the tightest scope,
   reversing the regression.

Scope note carried to the maintainers: the fix coalesces **all** UniformConstant
resource-element loads (bindless heap *and* plain `Texture2D[N]`), not just descriptor-heap —
kept broad deliberately (narrowing to a `__slang_resource_heap` magic-name check is exactly the
unprincipled special-case CLAUDE.md red-flags; the invariant is general). Foregrounded in the
PR body for conscious maintainer ratification. `[ForceInline]` on the reporter's helper is a
usable workaround *today* (inlines → caller-side shared load → coalesces to 1).

## Durable reasoning lessons

- ⭐⭐ **Measurement is dispositive over a plausible alternative.** jkwak's "just mark the
  cast (`CastDescriptorHandleToResource`) movable" was empirically refuted — his variant → 6
  loads, FAILS 3/3; the load-movable variant → 2 loads, PASSES 3/3 — because on the default
  SPIR-V path a `DescriptorHandle<T>` does **not** lower to that cast; the redundancy is in the
  per-use `OpLoad`s, so the *load* must be movable, not the cast.
- ⭐⭐ **"SPIR-V-only" is not "narrow." A within-target predicate can still over-fire.** The
  pivot report asserted breadth was "structurally neutralized" but only checked *cross-target*;
  the raw predicate still reshaped scalar sampler globals *within* SPIR-V. Prove the scope
  against the collateral shapes inside the target, not just across targets.
- ⭐⭐ **An approver teardown at a near-terminal position loses an unrecorded verdict.** Two
  container restarts (instructions update) hit exactly when CI went all-green and the approver
  was one leg from recording — twice a verdict was one step from the ledger and lost. The
  reconciliation nudge on resume caught it (recorded WOULD_APPROVE mode=`live_late`, joined
  human APPROVED = shadow-mode agreement). A verdict only exists once it is in the ledger; on
  resume, reconcile the near-terminal state, don't assume the row landed.
- ⭐ **A bot's own manual CI dispatch on a non-draft PR yields a benign priority-yield red** —
  not a failure. See [[project_bot_pr_priority_yield_red_run]]. And debounce re-review on churn
  rather than nudging a bot to hold its own pushes — see [[feedback_debounce_pr_review_on_churn]].

## Follow-ups (tracked separately, NOT part of this closed chain)

- [[project_12120_direct_resource_params_flag]] — the cross-`[noinline]`-boundary image case:
  opt-in CLI flag reverting the #12027 image-as-index workaround (PR #12195). **LIVE / parked**
  on jkwak's AMD/Intel driver testing.
- [[project_12110_nonuniform_descriptorhandle_fixed_in_1415]] — NonUniformResourceIndex marker
  dropped on the DescriptorHandle heap path (benign/valid SPIR-V; later fixed).

## Related concepts

- [[project_11568_descriptor_heap_direct_index]] — direct-index `ResourceDescriptorHeap`
  redesign (input syntax; distinct from this codegen-reuse issue).
- [[project_fleet_disk_capacity_wall_11969]] — the disk-capacity escalation that briefly
  blocked #12120 (since cleared).
