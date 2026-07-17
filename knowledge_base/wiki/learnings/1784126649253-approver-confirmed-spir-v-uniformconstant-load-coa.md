---
title: "[approver/confirmed] SPIR-V UniformConstant load-coalescing is a decoration-neutral safe shape"
type: learning
topic: slang-compiler
source: learnings/1784126649253-approver-confirmed-spir-v-uniformconstant-load-coa.md
---

# [approver/confirmed] SPIR-V UniformConstant load-coalescing is a decoration-neutral safe shape

**Symptom / context:** PR #12111 (fixes #12051), our own fixer's bot-authored PR, coalesces redundant per-use `OpLoad`s of a read-only `UniformConstant` resource-element address in `insertLoadAtLatestLocation` (slang-ir-spirv-legalize.cpp). Decided WOULD_APPROVE (CLEAN), Devin-only tier. Awaiting human join.

**Root cause / why safe (the transferable class):** A SPIR-V-legalize load-coalescing change of this shape is safe-by-construction when three properties hold, and these are the exact things to probe on the *next* such PR:
1. **Dominance by construction, not by analysis.** The shared load is materialized `setInsertAfter(subAddr)` where `subAddr` is an element/field address minted *inside the same function* (never the root global-param addr, which stays `cacheable=false`). Every use it replaces is a use of the original `getElement` result → dominated by `subAddr` → dominated by the load. No cross-block hazard, no dominator-tree walk needed. Probe: confirm the cached key is only ever an in-function-created address, and the root is seeded non-cacheable.
2. **Decoration-neutrality.** On the `DescriptorHandle`/heap path the `NonUniformResourceIndex` marker is already stripped during handle specialization *before* SPIR-V legalize, so there is no signal at the fix site to gate on or to preserve. Coalescing a divergent-hoisted load is per-lane correct (divergence is across lanes, not loop iterations) and matches the already-shipping `spvDescriptorHeapEXT` path (2 loads, 0 `NonUniform`). NonUniform-*preservation* on DescriptorHandle-SPIR-V is a SEPARATE deliberate follow-up (sibling #12110) — do not conflate it with a regression in the coalescing PR.
3. **Read-only invariant, not builtin-name gate.** Scope broadening from bindless `DescriptorHandle<T>` to plain `Texture2D t[N]` is *emergent* from the `UniformConstant` = read-only-opaque-resource-memory invariant. A builtin-name gate (`__slang_resource_heap`) would be the anti-pattern CLAUDE.md flags. Ratified scope broadening is a feature, not a scope creep to abstain on.

**How to catch it (Step-0 recall for similar code):** For any SPIR-V-legalize CSE/hoist/coalesce PR, (a) verify the reused value's insertion point dominates by *construction* rather than trusting a claim; (b) check whether any per-lane/divergence decoration is live at the fix site or already stripped upstream — a stripped marker means neutral, a live one means you must confirm it's preserved; (c) confirm the regression test's `-target spirv-asm` actually runs under `SLANG_RUN_SPIRV_VALIDATION=1` (ci-slang-test.yml exports it, lines ~84/185) so the coalesced SPIR-V is validated, not merely FileCheck-matched — text `//TEST:SIMPLE` alone does NOT run spirv-val locally.

**Fix (decision):** WOULD_APPROVE was correct; the wiki investigation of #12051 (emit-time reload is a legalization artifact, guard-drop safe, EXT parity) fully pre-validated the safety basis. If this MERGES → agreement, confirms the shape. If closed-unmerged → false-safe watch: re-examine whether dominance-by-construction or decoration-neutrality had a hole I cleared. Related: [[pr-12119-decided]] (the #11152 producer-layer __ldg fix, same isPointerToImmutableLocation/SBT area), [[pr-11152-awaiting-join]] (false-safe: getRootAddr op-set — the analogous "does the address-walk peel the ops legalization actually inserts?" probe).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784126649253-approver-confirmed-spir-v-uniformconstant-load-coa.md`_
