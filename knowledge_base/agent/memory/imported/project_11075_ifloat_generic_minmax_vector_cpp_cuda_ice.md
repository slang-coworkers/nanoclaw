---
name: project-11075-ifloat-generic-minmax-vector-cpp-cuda-ice
description: "#11075 ICE: IFloat-generic min/max on vector, cpp/cuda targets — Real-fix-scope AUTHORIZED, fixer dispatched"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9fd7ec17-c358-440b-8d4e-d0f8385fab55
---

# slang#11075 — ICE: IFloat-generic min/max + vector instantiation on cpp/cuda

**State (2026-07-28):** FIX AUTHORIZED by jhelferty-nv (MEMBER + assignee),
comment 5098355553: *"create a PR with the 'Real fix scope' approach."*
Fixer built + implemented → **DRAFT PR #12249** (`fix/issue-11075` @ 587df9e124,
label `pr: non-breaking`; draft-held footprint posted on issue = comment 5099421214).
Draft-only; merge/ready is OPERATOR-gated. Fixer owns REQUEST_CHANGES (max-2-rounds).

**Review round 1 (2026-07-28): verdict REQUEST_CHANGES** (diff_hash 588a72291f48).
B (Devin) clean. A (correctness): 1🔴 + 1🟡 gap + 1🟡 nit. C (clarity): 4 advisory.
- 🔴 **matrix `$P` abort** (same crash class, pre-existing): `$P` unwrap only handles
  `IRVectorType`; `matrix<T,N,M,L> : IFloat` (core.meta.slang:2459) reaches the same
  `__min_impl`→`$P_min`→`default: SLANG_UNEXPECTED`. `genMax<T:IFloat>(float3x3)` on
  cpp/cuda aborts. **Routed resolution = DIAGNOSTIC option (option 2), NOT full matrix
  support** — full matrix min/max is beyond jhelferty's authorized vector scope; defer +
  flag in PR body. Add matrix regression case asserting diagnostic (not ICE).
- 🟡 test gap: 5/7 new vector overloads (F16,F64,I64,U32,U64) never instantiated. Add
  CPU-runnable double2/uint4/uint64_t2 rows + `max` at arity 2/4.
- 🟡 nit + clarity C001/C002/FG001: comment fixes (header name→`slang-cpp-types-core.h`;
  generalize `$P` comment to whole-family invariant; prelude element-set completeness;
  `Vector` fwd-decl sig-sync). C003: note matrix→not-vector + `__isVector<float3x3>` test.
ROUTED back to fixer 07-28 (round 1) w/ combined-review.md attached.

**Round 1 ADDRESSED — new head 8fecff4def** (force-pushed, PR body updated, still draft):
- 🔴 matrix → diagnostic option (b): new error `55215 unsupported-type-for-target-intrinsic`
  (slang-diagnostics.lua) replaces `SLANG_UNEXPECTED` at `$P` default arm; new
  `generic-minmax-matrix-11075.slang` asserts `float3x3`→E55215 (was E99997). Matrix support
  deferred/out-of-scope in PR body. (Caveat: E55215 location reports hlsl.meta.slang because
  `__max_impl` force-inlined — pre-existing infra limit, matches sibling UnsupportedTargetIntrinsic,
  flagged advisory in PR body.)
- 🟡 test gap → expanded vector test: F64(min double2)+U32(max uint4)+U64(min uint64_t2)+max@arity4.
  F16/I64 rows documented not-instantiated-locally (no overclaim).
- 🟡 4 comment/clarity all done ($P general invariant; prelude completeness; Vector fwd-decl→
  slang-cpp-types-core.h+ODR; peephole matrix→false + __isVector<float3x3>→0.0 test).
- Verify: vector regr PASS cpu/cuda/vk; matrix diag PASS; generics 255/255; repro OK cpp+cuda;
  codex re-APPROVE. ROUTED to slang-reviewer for round-2 re-review @ 8fecff4def.

**Review round 2 (2026-07-28): verdict REQUEST_CHANGES (light)** @ 8fecff4def
(diff_hash 76ad620a447e). Round-1 items ALL resolved (matrix→E55215, test gap, 4 clarity).
Devin clean. Reviewer A budget-capped mid-synthesis ($30.03); findings recovered from
stream.jsonl + reviewer-reverified vs source (drift 0). Reviewer note: "APPROVE_WITH_NITS
defensible; residual pre-existing + off authorized vector scope."
- 🟡 Finding 1 (should-change, PRE-EXISTING, off-scope): E55215 net only fires on `default:`
  (no-prefix) arm. Vector element types that HAVE a `$P` prefix but NO vector helper
  (IPTR/UPTR — scalar helper exists, no vector; I8/I16/U8/U16 — neither) bypass the arm,
  emit e.g. `IPTR_min(wholeVector)` → downstream C++/CUDA compile error (not clean E55215).
  `vector<intptr_t,N>`/`vector<int16_t,N>` conform (core.meta.slang:2324 IInteger) + reach
  path (reviewer compile-probed on master: E99997). Pre-existing (not regr).
  **PR comment "IPTR/UPTR are not vector element types" is FALSE** (in-scope — PR added it).
- 🟡 Finding 2 + clarity C001/FG007: default-arm comment says only "matrix" (undersells);
  55215 near-homograph of existing 55204 UnsupportedTargetIntrinsic — disambiguate.
- clarity C002/FG001/FG002/FG004/FG005: low-conf polish (prelude caller rationale; reported-type
  note; F16 CPU-uncond vs CUDA #if asymmetry; test entry-point convention; `…C` suffix doc).

**ROUTED to fixer round-2 (FINAL of max-2), 07-28:** [MUST] fix false comment;
[SHOULD] complete E55215 net for prefix-having/no-vector-helper vectors (option b, consistent
w/ matrix — NOT add IPTR/UPTR support=option a=creep) + regr test; [NICE if cheap] the nits.

**Round 2 ADDRESSED + CLOSED — new head f982361332** (8 files +313/−19, still draft):
- [MUST] false "IPTR/UPTR are not vector element types" comment → replaced w/ accurate
  supported-set framing ({F16,F32,F64,I32,I64,U32,U64} supported; IPTR/UPTR+narrow-int
  reachable but intentionally unsupported→diagnosed).
- [SHOULD option b] `$P` expander now tracks per-prefix `hasVectorHelper`; raises E55215 when
  no `$P` prefix (matrix) OR vector w/ scalar-only-helper element (IPTR/UPTR/narrow-int). No
  IPTR/UPTR vector helpers added (option a rejected=out-of-scope). New DIAGNOSTIC_TEST
  generic-minmax-intptr-vector-11075.slang (vector<intptr_t,2>→E55215).
- [nits] 55204-vs-55215 distinguishing note added; default-arm bounding invariant documented.
  Optional prelude/F16/test-consistency nits skipped (diff bloat).
- Verify (BUILD_EXIT=0): matrix+intptr/int16 vectors→E55215; **OVER-DIAGNOSIS GUARD CONFIRMED**
  scalar int16/intptr still emit I16/IPTR NOT diagnosed; float/int vectors unaffected; generics
  256/256; 5/5 diag/regr tests; codex re-APPROVE.

**MAIN LIGHTWEIGHT-VERIFIED @ f982361332 (07-28):** read `case 'P'` on branch — diagnostic is
correctly vector-gated (`argIsVector && !hasVectorHelper`); scalar narrow-int/ptr emit prefix
un-diagnosed (no scalar regression); authorized vector cases emit prefix; matrix + no-vec-helper
vectors → E55215. PR body live/current, draft, non-breaking. NO third reviewer round (as committed).
**CHAIN PARKED — awaiting maintainer jhelferty-nv to flip ready/merge (OPERATOR-gated).** Issue
footprint = comment 5099421214 (still accurate: "draft PR held pending review/approval"); PR desc
is the current executive summary. CI red = benign draft priority-yield (not a failure).

**Bug:** `min<T>`/`max<T>` called from a `T:IFloat` (or `IComparable`) generic
context, specialized on a vector (`float2/3/4`), aborts on `-target cpp`/`cuda`
with `unexpected type in intrinsic definition` (`E99997`). metal/hlsl/glsl/wgsl OK
(bare `"min"` maps to their overloaded vector intrinsic). Regression from PR #9593
(IComparable min/max overloads, merged 2026-01-15). Reproduced @ `3da83a82d`.

**Root path:** IComparable `min` body (hlsl.meta.slang:12960-12974) is the only
candidate at abstract-T generic site. `__isFloat<float3>()` folds to **true**
(peephole unwraps vector→element before `isFloatingType`), so body enters
`__min_impl` (`$P_min($0,$1)`). `$P` expansion switch
(slang-intrinsic-expand.cpp:682-720) has no `kIROp_VectorType` case → `default:`
`SLANG_UNEXPECTED` at :715.

**"Real fix scope" (AUTHORIZED — 3 areas together, from bot comment 4443874787):**
1. `slang-ir-peephole.cpp:1815` — `kIROp_IsVector` must check the **pre-unwrap**
   type (currently folds `__isVector<float3>()` to false — bug). Trivial.
2. `slang-intrinsic-expand.cpp:691-717` — extend `$P` switch to drill into
   `IRVectorType` and emit element-type prefix (`$P_min(float3)` → `F32_min(...)`).
3. `prelude/slang-cpp-scalar-intrinsics.h` + `prelude/slang-cuda-prelude.h` — add
   vector-arity `F32_min/max`, `I32_min/max`, `U32_min/max` (likely `F64_*` too).
   CPU: template on `Vector<T,N>`. CUDA: per-arity overloads for `floatN/intN/uintN`.

Narrow meta.slang-only approaches (1a vector `__min_impl` overload; 1b
`__isVector` short-circuit) were TRIED and FAILED — documented in comment 4443874787.
Do NOT retry them.

**Test gap:** no test for IFloat/IComparable-generic min/max specialized on vector,
cpp+cuda, with metal parity. Regression test required.

**Owners cc'd:** jkwak-work, gtong-nv (PR #9593 author), csyonghe (core-lib owner).
Reporter: BeezBeez.
