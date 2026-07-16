---
name: project_12119_ldg_optix_sbt_exclusion
description: "slang#12119 shape-independent __ldg exclusion for OptiX SBT — WOULD_APPROVE CLEAN, awaiting merge"
metadata: 
  node_type: memory
  type: project
  originSessionId: a7377421-d5b3-4f58-8dd7-be5b3ddbf7bd
---

shader-slang/slang#12119 (author szihs) — "Fix #10188: shape-independent `__ldg` exclusion for OptiX SBT loads". **Supersedes prior PR #11152** for the same issue #10188.

slang-pr-approver verdict — **WOULD_APPROVE (CLEAN)** at two heads, shadow mode (NOT posted to GitHub):
- **R1 @ cab4543af5fa** (ledger row stands per revision-chain rule): 6/6 clauses; PRIMARY github-actions[bot] 0🔴/3🟡; Devin 0/0.
- **R2 @ 8de9683706f8** (2026-07-15, diff_hash 4928bb761a88, mode=live/v0-shadow-relaxed): second `synchronize`, delta R1→R2 comment/format-only, **zero logic change**. Approver waited out the in-progress `Claude PR Review` run (~30 min; completed success 14:28Z) and re-harvested PRIMARY github-actions[bot] rather than falling to fallback — 🟡 2 gaps/1 question/**0 bugs**; review confirms walk reaches SBT root through BitCast/GetOffsetPtr legalization inserts. Devin 0/0. R1 challenger transfers verbatim (byte-identical logic).

Challenger ran the exact op-set completeness probe the **#11152 false-safe failed**: new `isAddressIntoOptiXShaderBindingTable` peel-set is a strict superset of `getRootAddr`, covers every SBT-reachable forwarding op. `lowerBufferElementTypeToStorageType` emits a `BitCast→Add→BitCast` where `kIROp_Add` is NOT peeled, but resolved (a) unreachable for SBT uniforms (that path is `AddressSpace::UserPointer`+unsized-array-gated; SBT is default-AS `ConstantBuffer` `FieldAddress` chain) and (b) failure-direction-safe (walker miss → returns `false`/mutable → no `__ldg`, opposite of #11152). Sole producer of `kIROp_CUDALDG` is this pass; failure direction cannot miscompile (removes `__ldg`, observable at FileCheck). Correct producer-layer fix, vindicated by #11152 postmortem — cf. [[project_11323_casttovoid_closed_wronglayer]].

**WATCH:** on merge → agreement (WOULD_APPROVE ≡ APPROVED-equiv). **closed-unmerged would be the false-safe watch** given #11152 history. Human owns merge; shadow → no posting either tier.
