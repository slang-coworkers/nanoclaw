---
name: project_11545_bytebuffer_alignment_chunker_stack
description: "#11545 ByteAddressBuffer alignment-chunker series — [1/3]#11594 + [2/3]#11595 MERGED, [3/3]#11803 shadow WOULD_APPROVE CLEAN @77907d69a5 (awaiting human/CODEOWNERS merge). Review arc R1→R4; root cause = fxc/DX≤5.0 templated .Load<T> regression, fixed by guarding the chunker behind useBitCastFromUInt."
metadata:
  node_type: memory
  type: project
  originSessionId: 5bec4191-e017-44da-b211-e48a8839d909
---

# #11545 ByteAddressBuffer alignment/access series

shader-slang/slang **#11545** — the #11564 monolith split into a **stacked PR series** driven by slang-fixer. Canonical thread `gh-issue-shader-slang/slang-11545`. **Converged 2026-07-19; terminal-pending-merge.**

*Distilled 2026-09-18 by /okf-synthesis from the per-event working log; the durable facts, the technical root cause, and the reusable lessons are kept — the blow-by-blow timeline was pruned.*

## Series status (terminal)

- **[1/3] #11594 — MERGED.**
- **[2/3] #11595 — MERGED** (`c6a2610682`, the natural-alignment revert; see [[project_11595_byteaddressbuffer_align_block.md]]).
- **[3/3] #11803 — OPEN on master, shadow-approver WOULD_APPROVE CLEAN @`77907d69a59006f3`; awaiting CODEOWNERS/human merge.** Slice-4: the widest-aligned-chunk optimization (12 chunker symbols). Non-redundant with [2/3] — [2/3]'s not-wide-aligned path goes straight to `emitLegalSequenceLoad` (full per-component scalarize); [3/3] inserts a widest-aligned-chunk middle before the scalar fall-through.
- **Monolith #11564 — CLOSED** (unmerged, in favor of #11803). **Dup #11596 — CLOSED** (superseded by #11595). Maintainer (jkwak) closed both himself; the bot only posted a closing ack ([[feedback_github_writes_operator_authorized.md]]).

## Root cause and fix (the durable technical content)

The review arc turned on an **fxc/DX≤5.0 codegen regression** that CI could not see:

- **Symptom:** partially-aligned vector byte-address loads/stores (e.g. `LoadAligned<float4>(loc,8)`) on fxc/DX≤5.0 HLSL emitted templated `.Load<float2>` / `.Store<float2>` — **fxc-uncompilable** — where master scalarized to the fxc-compatible `uint`+`asfloat` path.
- **Why:** [3/3]'s chunker replaced the `!isWideAccessAligned` branch (which routed partial-aligned accesses through `emitLegalSequenceLoad` → scalarize → `uint`+`asfloat`, fxc-OK) with `emitLegalChunkedVectorLoad`/`Store`. Its `float2` sub-chunks are themselves wide-aligned → hit `emitSimpleLoad` → raw templated vector access, never reaching the `useBitCastFromUInt` bitcast branch (which only covered the now-unreachable whole-vector fall-through). Authoritative statement that templated `.Load<T>` is fxc-incompatible: `slang-emit.cpp` (the `useBitCastFromUInt`-for-DX≤5.0 mechanism).
- **CI-invisible:** the new tests used `-target hlsl`/`spirv`, not `-profile cs_5_0`, so no leg exercised the fxc path.
- **Fix** (`slang-ir-byte-address-legalize.cpp`, minimal/root-cause): guard **both** chunker call sites — when `m_options.useBitCastFromUInt` is set, fall back to `emitLegalSequenceLoad`/`emitLegalSequenceStore` (each scalar then routes through the existing uint-load/store + `asfloat`/`asuint`). `useBitCastFromUInt` is set only for HLSL DX≤5.0 (fxc) and WGSL (which scalarizes upstream), so the guard changes only the fxc path; modern targets keep the chunking. Added regression test `tests/compute/byte-address-buffer-chunked-fxc-11803.slang` (`-profile cs_5_0`, `CHECK-NOT: Load<`) so the fxc path is no longer CI-invisible.
- **Adjacent latent (out of scope, on record):** whole-aligned `float4`@16 on fxc also emits a templated `.Load<float4>` — but **master did too** (via `isWideAccessAligned`→`emitSimpleLoad`), so it is pre-existing, not a [3/3] regression. A separate fxc "fully templated-load-free" fix if maintainers want it.

## Review arc (R1→R4) — compressed

Four shadow-approver rounds, each a new `approval_decisions` ledger row at a distinct settled head:

1. **R1 BLOCK** @`1cfb3602cd` — CI-red from **two test-authoring bugs**, not a code defect: (a) a stray backticked `` `CHECK: Store` `` in a prose comment parsed as a live FileCheck directive and masked the real `CHECK-COUNT-2`; (b) `byte-address-buffer-consistency-11591.slang` still asserted slice-2's pre-chunk scalarize. **The initially-relayed "store chunker defect" evaporated under a live slangc build** — the store chunker was correct (`Store<float4>(0,…,8)` emits exactly two `float2` stores). Fixed tests-only.
2. **R2 BLOCK** @`76a840fc50` — a **real** fxc/DX≤5.0 code regression (above), empirically confirmed by a fixer build at `-profile cs_5_0`. Devin flagged it independently.
3. **R3 BLOCK** @`dbfb03c88b` — the R2 code fix was triple-confirmed resolved, but the fix itself introduced a **doc-precision defect**: PR-added `@remarks` in `hlsl.meta.slang` still said chunking "applies on every target, including HLSL," now false for fxc/DX≤5.0. (The approver's own DECISION_REVIEW gate caught its draft ABSTAIN_POLICY as an improper downgrade → corrected to BLOCK: policy is any verified 🔴 ⇒ BLOCK, no doc exemption.)
4. **R4 WOULD_APPROVE CLEAN** @`77907d69a5` — `@remarks` reworded ("most targets, incl. modern HLSL … exception is fxc/DX≤5.0 … scalarized to uint+asfloat/asuint"); code byte-identical to R3, 6/6 clauses pass. Fresh Devin still lagged (listed the already-fixed `hlsl.meta.slang:471` 🔴; refuted vs settled-head source).

**Arc shape:** R1 BLOCK (false correctness flag, CI-red from test bugs) → R2 BLOCK (verified fxc code regression) → R3 BLOCK (fix introduced a doc 🔴) → R4 WOULD_APPROVE (doc closed, code preserved).

## Reusable lessons (cross-links)

- **Build-to-confirm resolved both directions:** R1's inferred defect evaporated under a build; R2's inferred defect was confirmed under a build. Do not relay an inferred verdict as fact — [[feedback_never_relay_a_verdict_not_in_hand.md]].
- **Parallel-session collision (flagged twice this chain):** a webhook (jkwak comment) and an a2a dispatch (Main's red-bug reconciliation) about the same in-flight branch each minted a fixer session on the shared worktree; they converged without harm because the second session verified the first's content before re-pushing. **Dispatch hygiene:** pin a RED re-triage / comment about an in-flight fixer PR to the existing owning session via `target_session_id` rather than minting a fresh one. See [[feedback_let_fixer_own_single_session.md]], [[feedback_red_retriage_single_owner_routing.md]], [[project_stacked_pr_shared_base_clobber.md]], [[project_fork_reentrancy_phantom_codriver.md]].
- **Stacked-PR-post-parent-merge handling:** after [2/3] merged, [3/3] briefly showed "ready for merge" without approval because it sat non-draft on an unprotected base branch (`fix/issue-11591`) with no CODEOWNERS gate. Rebasing onto master + retargeting the base restored `reviewDecision=REVIEW_REQUIRED`. Avoids [[project_stacked_pr_shared_base_clobber.md]].

**Blocker:** none. #11803 shadow-CLEAN, webhook-driven — awaiting human join (CODEOWNERS review + merge); the bot flips/merges nothing. A human CHANGES_REQUESTED re-opens via the owning fixer session `sess-1784431404501-dk6smp` (pin per [[feedback_red_retriage_single_owner_routing.md]]).
