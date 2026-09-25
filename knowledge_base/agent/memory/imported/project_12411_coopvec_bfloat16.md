---
name: project_12411_coopvec_bfloat16
description: "slang#12411 CoopVec BFloat16 (SM6.10 linalg) — jkwak authorized 08-21 (two coopVecLoad overloads: __BuiltinArithmeticType + ICoopElement); slang-fixer dispatched, PR1 (core-module) building, PR2 (HLSL-only slice) planned. Adjacent: 2 dropped review findings on his own PRs #10723/#10711."
metadata: 
  node_type: memory
  type: project
  originSessionId: dd6c5348-62db-4101-8b01-d603c9d1d751
---

# slang#12411 — BFloat16 as a CoopVec component type (hlsl-specs 0035, SM 6.10)

Filed by **jkwak-work** (maintainer, self-assigned) 2026-08-06; triaged, issue Type set to
`Feature`. Canonical thread `gh-issue-shader-slang/slang-12411`.

## Current state (last recorded 2026-08-21)
jkwak authorized at 16:10Z (*"make a PR as discussed"*) and answered the scope question:
**two `coopVecLoad` overloads** — one `__BuiltinArithmeticType`, one `ICoopElement`, NOT a single
relaxed bound. `slang-fixer` dispatched (branch `fix/issue-12411`, worktree `wt-slang-12411`): bound
→ `ICoopElement` + `IArithmetic` extension + the two overloads; **PR1 debug build in progress** as
of 23:25Z. **Two-PR plan:** PR1 core-module (spelling-independent) first, PR2 the caveated HLSL-only
interpretation slice. (Handoff was dropped ~6h after authorization; jkwak chased at 22:30Z —
[[feedback_a_verified_authorization_not_dispatched_is_a_dropped_handoff]]. Watch that
`report_pr_created` fires on PR1/PR2 open — [[feedback_verify_report_pr_created]].) No progress past
build-in-progress is recorded here; re-verify GitHub before acting.

**Retracted:** an earlier stored "don't ship the enum without SPIR-V (`:9920`)+CUDA (`:25`) mapper
cases" instruction was RETRACTED after source re-check @`6a009a7f9` — SPIR-V short-circuits before the
mapper (the `SLANG_SCALAR_TYPE_BFLOAT16` guard at slang-emit-spirv.cpp:10000 fires
`UnsupportedTargetIntrinsic` and returns; a BFloat16 mapper case is dead code) and CUDA/OptiX
diagnoses gracefully (`getOptixCoopVecComponentTypeName` returns an empty slice at its default,
slang-emit-cuda.cpp:46). ⇒ **BFloat16-as-coopvec-component is genuinely HLSL-SM6.10-only**; PR2 touches
only the HLSL path. A 15-day-old file:line is a conclusion, not a measurement:
[[feedback_a_stored_claim_re_shipped_as_a_live_finding]].

## The reframe: two separable axes
The issue presents three blockers as one feature; they are **two independent axes**:
- **Interpretation axis** (blockers 1+3): `CoopVecComponentType` values are *interpretation* operands
  (matrix, input vector, AND bias), lowered as constants.
- **Register axis** (blocker 2): `CoopVec<T,N>`'s `T` is the element type held in registers.

Nothing forces the two to agree. Decisive measured cell:
`coopVecMatMul<float,4,4>(vec, ::Float16, matrix, 0, ::FloatE4M3, RowMajor, false, 4)` compiles and
emits `dx::linalg::ComponentType::F8_E4M3` — `FloatE4M3` works as an *interpretation* while
`CoopVec<FloatE4M3,4>` is rejected `E38029` (same as BFloat16, FloatE5M2). ⇒ blocker 2 is not
BFloat16-specific and 1+3 can land alone. But **separable ≠ out of scope**: `coopVecLoad<let N, T :
__BuiltinArithmeticType>` (`hlsl.meta.slang:32489`) takes no interpretation parameter, so the bound
alone gates it and the issue names it — [[feedback_independence_of_two_axes_is_not_evidence_one_is_out_of_scope]].

## The maintainer design call — narrowed, deliberately NOT decided
`CoopVec<T : __BuiltinArithmeticType, let N> : IArray<T>, IArithmetic` (`hlsl.meta.slang:30659`) vs
`CoopMat<T : ICoopElement, ...>` (`:28262`). `CoopMat<BFloat16,...>` is accepted today
(`BFloat16 : IFloatingPointCoopElement` extends `ICoopElement`, `core.meta.slang:1742`). But the
precedent is **partial**: `CoopMat : IArray<T>` is its ONLY base (no `IArithmetic`/`IComparable`) and
defines zero `equals`/`lessThan`; `CoopVec` adds a behavioural contract on top (`IArithmetic :
IComparable`, `core.meta.slang:140`).

`IComparable` requires THREE methods, `CoopVec` implements all three with per-element scalar ops on `T`:

| method | at | scalar op |
|---|---|---|
| `equals` | `:31127` | `this[i] != other[i]` (`:31131`) |
| `lessThan` | `:31145` | `<`/`>` (`:31149`/`:31153`) |
| **`lessThanOrEquals`** | **`:31167`** | `<`/`>` (`:31171`/`:31175`) |

`BFloat16` satisfies none (`a != b`, `a < b`, `a + b` each `E39999 ambiguous`; `half` control clean)
and is NOT in `FOREACH_BASE_TYPE` (`slang-type-system-shared.h:64-82`) so it sits outside the generated
conformance loop (`core.meta.slang:1135-1180`). ⚠️ `lessThanOrEquals` was missed by both tiers via a
regex-prefix hazard (`lessThan` is a strict prefix) — **census an interface by enumerating what it
REQUIRES then checking each; print the census, never the total**:
[[feedback_a_correct_total_from_a_wrong_composition_is_luck]].

⇒ **Neither bound is mechanical.** Narrowing leaves `equals`/`lessThan` unsatisfiable; general
`__BuiltinArithmeticType` conformance needs arithmetic AND all three comparisons for a non-BaseType
struct. **Third option (offered, not picked):** give `BFloat16` the missing scalar operators first,
which makes either bound viable — and if chosen, the scalar work must cover all three `IComparable`
methods. Whether FloatE4M3/E5M2 should become element types is also a human call.

## Open question 1 — DXC spelling
hlsl-specs 0035 spells **`BFloat16 = 23`** under `// BEGIN NEW FOR SM 6.10`. ⚠️ The DXC Slang pins
(`cmake/FetchDXC.cmake:49` → `v1.9.2602`) does NOT have it — its `ComponentType` ends at `F8_E5M2 = 22`
and the vendored `dx/linalg.h` has no `ComponentType` enum. Slang's SM 6.10 spellings are hardcoded
(`slang-emit-hlsl-prelude.cpp:386-425` coopvec, `:305-345` coopmat), not header-read. **Interim
decision (greenlit):** proceed with `BFloat16 = 23` in the caveated PR2 with a loud in-code flag
(cf `F8_E4M3FN`→`F8_E4M3` precedent) + PR-body caveat — waiting for the pinned DXC to validate has no
bounded end; emit is a one-line swap if the shipped spelling differs. **jkwak's review is the real
gate** — [[feedback_a_spec_proposals_spelling_is_not_the_emission_authority]]. SM 6.9 genuinely cannot
express bfloat16, so jkwak's "diagnose at 6.9, gate on `sm_6_10`" is correct.

## Two adjacent pre-existing HLSL crashes — BOTH are DROPPED REVIEW FINDINGS (offer-and-wait; jkwak's word gates filing)
Neither is about BFloat16. Both were raised pre-merge on jkwak's own SM 6.10 PRs and dropped; the
triager offered to file both in comment `5209061497` and did NOT file unilaterally.

1. **Three 64-bit enumerators crash HLSL emit** (`Float64`, `SignedInt64`, `UnsignedInt64`) —
   user-reachable at cs_6_9 AND cs_6_10 → 255 `E99997 ... Unsupported cooperative vector component type
   for HLSL emission` (controls `Float32`/`SignedInt32` → 0). All three are in the Slang enum
   (`hlsl.meta.slang:32556`) and the SPIR-V mapper but have **no case** in `getCoopVecComponentType_enum`
   (12 `case`s, 0 for INT64|FLOAT64|BFLOAT16, then `default: SLANG_UNEXPECTED`) — the enum-vs-mapper
   asymmetry makes it a **regression**, not never-supported. **Raised pre-merge on #10723** as inline
   comment [3029202982](https://github.com/shader-slang/slang/pull/10723#discussion_r3029202982)
   (2026-04-02, github-actions[bot], titled "🟡 Gap: 64-bit type cases removed without validation
   guard") — predicts the exact abort, proposes two fixes; **merged 8.6h later with 0 replies**, live
   4 months. ⇒ file as "a review finding raised pre-merge on #10723 and dropped, covering all three
   64-bit types." Both tiers' dedup missed it because of the `in:body` qualifier (excludes all comments),
   not vocabulary — [[feedback_in_body_qualifier_silently_excludes_every_comment]].

2. **CoopMat HLSL path diagnoses THEN asserts** (a 4th site the issue doesn't list):
   `getCoopMatComponentTypeName` diagnoses `UnsupportedCoopMatElementTypeForHlsl` and returns nullptr,
   then `SLANG_RELEASE_ASSERT(componentType)` (`emit-hlsl.cpp:2034`) fires ⇒ `CoopMat<BFloat16,...>
   -target hlsl` emits BOTH `E55208` AND `E99997 assert failure` (control `CoopMat<half,...>` → 0).
   **The fix for blocker 3 must not copy this shape.** Raised pre-merge on **#10711**, cited inline
   comments **3024347842** + **3024476707** (both slang-emit-hlsl.cpp) — the second supplies the fix.
   The shape was re-flagged on nearly every push for two days (15 top-level `SLANG_RELEASE_ASSERT`
   flags: 13 github-actions[bot] + 2 coderabbitai[bot] across 7 commits), so "re-flagged repeatedly,"
   not 15 independent findings. Narrow the claim: #10711 DOES have 4 replies but **zero to either cited
   id**, so "merged with no reply on these threads" holds; "no replies on the PR" would be false.
   ⛔ Instrument trap that hid this: bare `gh api .../comments` returns exactly the 30-default page —
   always `per_page=100`, a count landing on 30/100 is a truncation suspect
   [[feedback_a_round_count_at_a_page_boundary_is_a_truncation_signal]].
   ⚠️ Carry into the fix: only **two** of three helpers can return nullptr — `getCoopMatMatrixUseName`
   (`slang-emit-hlsl.h:170`) takes no `DiagnosticSink` so it `SLANG_UNEXPECTED`s and cannot
   diagnose-then-return-null; the review comment overreached by including it. The nullptr-guard precedent
   (`emit-hlsl.cpp:1579-1585`) returns `true` from `bool tryEmitInstExprImpl`, but the crash site is in
   `void emitSimpleTypeImpl` so it needs a bare `return`; the three helper calls interleave with their
   asserts, so a combined guard must hoist all calls above the first check. Find precedents by
   structure, not by string. Corrects the issue: "CoopMat already supports bfloat16" holds for
   **SPIR-V/CUDA only** (`tests/cooperative-matrix/bfloat16.slang` runs `-vk`+`-cuda`); HLSL rejects it.

## A possible THIRD crash — UNVERIFIED, do NOT publish
From the #10711 flag census, `coopMatMulAdd(..., saturatingAccumulation: true)` targeting HLSL may hit
a bare `SLANG_RELEASE_ASSERT` at `slang-emit-hlsl.cpp:1601-1603` (0 diagnose calls in that block), which
would be worse-in-kind (no `E55208` first); `saturatingAccumulation` is a documented public parameter.
NOT established: (a) no execution cell (source-read only); (b) the "no saturating diagnostic exists"
control FAILED (the two known CoopMat diagnostic names aren't grep-findable anywhere but the prelude, so
the zero is uninterpretable — a control validates the instrument, never the target). Owed before it gets
a number: one execution cell, a real dedup, and whether it's the same site as the 7-flag shape.

## Coverage gap & provenance
`tests/cooperative-vector/` = 71 files, 0 mention BFloat16 (control: 12 mention `Float16`); `FloatE4M3`
in 0 either ⇒ a BFloat16 codegen test is new ground. Triage verified @master `d7d59f374` with ~20
compile cells each paired with a control; core-module freshness proven behaviourally + empty `git log`
over `*.meta.slang`; codex 3 rounds (6→3→approve). ⚠️ `extras/formatting.sh` cannot run in the triager
container (gersemi/clang-format/prettier/shfmt absent) ⇒ the PR author must format elsewhere.

**Related** (not dup, 4 enumerated dedup searches with controls): #8711, #11613, #7077, #10750, #7078,
[[project_12321_bfloat16_vector_vulkan_wrong_lanes]].
