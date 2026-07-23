---
name: project_12104_spirv_vec3_constantcomposite_overcount
description: "#12104 SPIR-V vec OpConstantComposite hardcoded-4 over-count — ✅ TERMINAL/CLOSED. Root=downstream spirv-opt (KhronosGroup#6798), integrated #12184; regression test PR #12193 MERGED 07-23"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8ba353b0-709c-4921-b4b7-4836fa3b1499
---

**UPDATE 2026-07-14 (re-triage — repro landed): REPRODUCED + root-caused LAYER. HELD for maintainer A-vs-B decision. NO fixer dispatched.**
- jkwak updated the issue BODY (not the comment) with a real repro and asked @nv-slang-bot to re-triage (cmt 4974810645). Chain re-opened. Re-triage comment posted: https://github.com/shader-slang/slang/issues/12104#issuecomment-4975044405 ; `reproduced` label applied.
- **Minimal repro (ToT Debug `33f9ed0ce`):** runtime `value / value` self-division of a float3:
  `output[0] = (value < 0.00001f) ? 0.0f : (value / value);` → emits `OpConstantComposite %v3float %float_1 ×4` (4 on vec3) → spirv-val rejects. CONFIRMED.
- **ROOT-CAUSE LAYER PROVEN = downstream vendored SPIRV-Tools `spirv-opt`, NOT Slang IR/emit** (corrects jkwak's own first-pass leads about processConstructor/emitCompositeConstruct/MakeVector). Evidence: (1) Slang `-dump-ir` keeps `div(%v,%v)` intact through the last dumped pass — no MakeVector/fold/4-op inst in Slang IR at O0 or default; (2) `-O0` output CORRECT (`OpFDiv %v3float`); malformed constant only at `-O1/2/3/default`; (3) only pipeline delta O0→default is the downstream optimizer — `slang-emit.cpp:3292` pipes through `PassThroughMode::SpirvOpt` (`external/spirv-tools` @ b707790a = v2026.3) when opt≠None; (4) fp-mode-gated: `precise`→`OpFDiv;NoContraction` clean, `fast`/default→malformed (x/x→1 only valid under fast-math, IEEE 0/0=NaN); (5) over-count is a HARDCODED 4, width-independent — float2/float2 ALSO gets 4 constituents (smoking gun it's not a vec4→vec3 shrink); (6) Slang's own folds correct (`v-v`→3-constituent zeros at slang-ir-peephole.cpp:219; `v*v` stays OpFMul; only `v/v` unfolded, left for spirv-opt — Slang has no x/x→1 rule).
- **Exact spirv-opt rule = HYPOTHESIS** (layer proven, line not pinned): likely `folding_rules.cpp` reciprocal/redundancy path building ones-vector with fixed 4-count. Needs spirv-opt step-through — only for Approach A.
- **Internal fix directions (A/B/C — kept OFF public comment):** A = upstream/vendor SPIRV-Tools fix (true root; slow third-party; blast radius all consumers). B = Slang-side add fast-math-gated `x/x→1` fold w/ correctly-sized ones vector (mirror `v-v` path) so spirv-opt never sees vulnerable `OpFDiv %a %a` — actionable in-tree; must gate on fast-math. C = emit-time count guard — does NOT catch this (bug is post-emit/downstream); general net only. Triager recommends B actionable + pursue A upstream.
- **Disposition: A-vs-B is a maintainer policy call (vendored-submodule + fast-math semantics). NOT auto-dispatching slang-fixer. Held pending jkwak/maintainer direction; Main routes fix once chosen. Posted a maintainer-facing verdict-question comment on #12104 asking A vs B (cmt 4975074195).**
- **UPDATE (jkwak answered the fork, cmt 4975199025): jkwak filed the UPSTREAM issue KhronosGroup/SPIRV-Tools#6794 → he's driving Approach A (upstream spirv-opt fix). Chain now HANDED OFF / awaiting external dependency (SPIRV-Tools upstream). Open sub-question: does he want in-tree B (fast-math `x/x→1` fold) as an INTERIM while 6794 pends, or hold for upstream + submodule bump? Default = hold for upstream unless jkwak asks for B. Ack + sub-question posted cmt 4975209421.**
- **UPDATE (upstream MERGED, cmt 4996028191): jkwak reports SPIRV-Tools fix merged — issue #6794 + PR KhronosGroup/SPIRV-Tools#6798 ("opt: Fix invalid vector constant folding size" — uses actual vector component count instead of hardcoding 4). Approach A landed upstream; B-interim MOOT. Ack cmt 4999623518.**
- **UPDATE 2026-07-17 (submodule bump LANDED + regression-test PR REQUESTED, cmt 5051758454): jkwak — "latest SPIRV-Tools integrated yesterday (PR shader-slang/slang#12184), we have the fix now. @nv-slang-bot can you make a PR that adds a regression test for this issue?" → COMPILER FIX ALREADY IN via #12184; remaining work is TEST-ONLY. DISPATCHED to slang-fixer.**
- **UPDATE 2026-07-22: TEST PR OPENED + MAINTAINER-APPROVED, held for merge. NEAR-TERMINAL.**
  - **PR #12193** — https://github.com/shader-slang/slang/pull/12193 — "Add regression test for #12104", author nv-slang-bot[bot], head `fix/issue-12104`, base master, ONE new file `tests/spirv/vector-self-divide-fold-size.slang` (+20), test-only (no compiler code), "Closes #12104".
  - **jkwak-work APPROVED** ("Looks good to me") 2026-07-22T23:24:36Z; PR is non-draft, reviewDecision=APPROVED. **`merged_at: null` — NOT merged yet.** VERIFIED against live GitHub state (get_pull_request + get_pull_request_reviews).
  - Test design: compiles float3 `value/value` self-division at explicit `-O1` (slang-test injects -O0 otherwise, at which the spirv-opt x/x fold doesn't fire), `-target spirv-asm -emit-spirv-directly`; FileCheck `// CHECK: OpConstantComposite %v3float %float_1 %float_1 %float_1{{$}}` — the `{{$}}` end-anchor distinguishes the correct 3-constituent line from the buggy 4. Validation is NOT the signal (runs pre-spirv-opt); the anchored operand-count check is.
  - Peer slang-reviewer pass SKIPPED — superseded by the authorizing maintainer's direct approval (jkwak requested the test AND approved it). Reasonable; not re-routing to review.
  - Bot does NOT merge/flip/push (a push would auto-dismiss jkwak's approval). Held for maintainer/human merge; issue auto-closes on merge.
  - Earlier ci_failed webhook on this PR = benign priority-yield on the draft manual CI dispatch (builds skipped), not a real failure.
  - fixer CONFIRMED it called `report_pr_created` (msg #52) → merge webhook routes back to this chain. codex-critique gate cleared (PLAN caught the -O0-injection → explicit -O1; CODE corrected validation-vs-FileCheck overclaim; OUTPUT approved). `pr: non-breaking` label added.
  - **✅ TERMINAL 2026-07-23: PR #12193 MERGED by jkwak-work (merge commit 56eb1aa085, merged_at 2026-07-23T02:29:50Z — VERIFIED live: state=closed, merged_at set). #12104 auto-closed via "Closes #12104". Non-draft CI green on all 34 build + test-slang/test-slang-rhi jobs (incl test-compile-regression where the new test runs); only reds were test-falcor (known infra flake, zero blast radius for a tests/spirv .slang) + check-ci rollup — fixer reran, maintainer merged. Worktree wt-slang-12104 + sentinel reaped. CHAIN CLOSED. Topic file persists.**
  - **Arc (textbook):** triaged (repro-blocked) → jkwak added repro → REPRODUCED at ToT → root-caused to downstream vendored spirv-opt x/x→1 fold hardcoding 4-component ones-vector (NOT Slang; corrected jkwak's own leads) → surfaced A-vs-B fork to jkwak → he drove A upstream (KhronosGroup/SPIRV-Tools#6794→#6798 "opt: Fix invalid vector constant folding size") → integrated to Slang via submodule bump #12184 → jkwak requested regression test → fixer shipped test-only PR #12193 (`tests/spirv/vector-self-divide-fold-size.slang`, -O1 + `{{$}}`-anchored FileCheck on post-opt asm) → jkwak APPROVED → MERGED.

---
### Original triage (2026-07-14, pre-repro) below —

shader-slang/slang#12104 — "[SPIR-V] OpConstantComposite has four constituents for float3 in Transmission.rgs.hlsl". Filed by jkwak-work (maintainer). Labels: spirv_validation, Additional Triage, spirv_vulkan, bug. Type set to Bug by triager.

**Symptom:** direct SPIR-V gen (1.5 / Vulkan 1.2) emits `%N = OpConstantComposite %v3float %float_1 %float_1 %float_1 %float_1` — a vec3 constant with FOUR constituents. spirv-val rejects (constituent count ≠ vector component count). This is an OVER-count (4>3), NOT the sub-vector under-count case `float3(float2(..),c)` (2<3) that jkwak's own minimal test passes.

**State (2026-07-14): TRIAGED & PARKED at needs-info. Repro-blocked. NO fixer dispatched.**
- Triager ran ~11 reduced shapes on near-HEAD Debug slangc `33f9ed0ce` (swizzle-to-vec3, splat, .rgb, -O0/2/3, arith fold, saturate, lerp, matrix-row .xyz) — ALL emit correct 3-constituent composite. jkwak's own `float3(float2(1,1),1)` also validates. Implicit float4→float3 truncation rejected at type-check (E30019). → cannot reproduce from reductions; applied neither `reproduced` nor `not-reproduced` per labeling rules.
- Triage comment: https://github.com/shader-slang/slang/issues/12104#issuecomment-4974702931 . Memo: triage-12104.md.

**Codebase digest (top-of-tree, for when repro lands):**
- Emit decision `slang-emit-spirv.cpp:9498-9514`: module-scope MakeVector (parent==ConstantsAndTypes) → emitOpConstantComposite, else emitOpCompositeConstruct. Dispatch at :2824.
- Emit loop `:1272-1280` (OperandsOf): one SPIR-V operand per IR operand, NO flatten, NO count check.
- Missing guard `slang-emit-spirv-ops.h:1417-1425`: emitOpConstantComposite asserts nothing about constituent==element count.
- Normalizer `slang-ir-spirv-legalize.cpp:1780-1814` `processConstructor`: flatten gate :1784 fires ONLY when MakeVector && parent==ModuleInst && operandCount!=elementCount. Function-scope not normalized.
- **Leading ordering gap:** processConstructor runs in main worklist (:2869); AFTER it `simplifyIRForSpirvLegalization` (:3324) runs peepholeOptimize (:3118) + SCCP (:3117) which can CREATE/FOLD MakeVector and does NOT re-enter processConstructor. Directly answers jkwak's "is this MakeVector created after SPIR-V legalization?"

**Two hypotheses (unconfirmed, need repro):** (1) vec4 constant whose result type is rewritten vec4→vec3 by a later fold without trimming its 4 operands (best fit for 4× identical float_1); (2) post-normalization MakeVector minted by peephole/SCCP after :3324, bypassing the :1784 gate.

**Candidate approaches (INTERNAL only — not posted publicly): A** emit-time loud guard at emitOpConstantComposite (backstop, satisfies "diagnostic before invalid SPIR-V"); **B** re-normalize after simplify / broaden gate to fire regardless of module-scope; **C** fix the producing pass (true root per "fix the producer"). Plan on repro: isolate producer → C + A net.

**Blocker / next-action:** reporter's full `Transmission.rgs.hlsl` + exact Slang version/commit + exact command line/API options + surrounding `%47`/`%v3float` decls. jkwak already requested these on the issue. Triager stays on thread, re-engages when a human replies. Dedup: distinct from [[project_12093_vector_initlist_coercion_inconsistency]] (front-end init-list splat vs tail-pad) and #9062 (diff-ptr-array illegal OpCompositeConstruct).
