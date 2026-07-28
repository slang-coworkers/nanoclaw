---
name: project_12247_slang_test_o3_spvopt_baseline
description: "slang#12247 — slang-test -O3 79-failure baseline for suite-wide SpvOpt (#11988); triaged/PARKED, jkwak self-owns"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4e8cb5d0-a01c-4419-9562-c8f3c996dacd
---

# slang#12247 — slang-test -O3 has 79 failures (SpvOpt suite-wide baseline)

Filed 2026-07-28 by **jkwak-work** (self-filed + self-assigned). Labels: slang-test, Testing.
The concrete failure baseline that must be understood before the suite-wide nightly
SpvOpt job [[project_11988_nightly_spvopt_workflow_parked]] (#11988) can be useful.
Related: #11805 (MERGED — defaulted slang-test to `-O0`), #11919 (OPEN — remove `-OX` opt-ins).

**Routing: PARKED at triaged. NO fixer dispatch** — jkwak self-filed + self-assigned
(standing `no-autofixer-jkwak-self-filed`). Recommendations are advisory for jkwak; triager owns forward.

## Triager verdict (slang-triager, 07-28, locally reproduced @ HEAD 15863db48, spirv-tools 0d6fd73c on L40S)

Repro: `build\Debug\bin\slang-test.exe -v failure -disable-retries -enable-debug-layers true -O3`.
`-O0` early-outs (slang-glslang.cpp:275) → all pass. `-O1/-O2/-O3` run the bundled spirv-opt pass list.

**CLASS 3 — REAL compiler-path aborts (P1; the priority).** Slang emits *valid* SPIR-V containing
constructs the BUNDLED spirv-opt asserts on. Debug `assert()`→`abort()` bypasses the graceful
messageConsumer/`SLANG_FAIL` path (that only catches soft `Optimizer::Run()==false`) → Windows sees
"exit 3 / no diagnostic / hang / lost RPC worker", Linux SIGABRT(134). Not hangs — hard asserts.
- `hlsl-intrinsic/substandard-fp-folding.slang` — EXIT=134 @ -O1/2/3. Assert `folding_rules.cpp:156 GetWordsFromScalarFloatConstant width==16/32/64`; test emits **fp8** (FloatE4M3/E5M2) constants. **REVIVES CLOSED #11766/#11767** (fp8 abort); #11766 closed only because #11805 made -O0 default so opt stopped running. `scalar-fp8.slang` STILL aborts @ -O3.
- `spirv/deduplicate-annotation-spirv-asm.slang` — EXIT=134 @ -O1 (reporter's "stuck>60s/lost worker"). Assert `aggressive_dead_code_elim_pass.cpp:1000` default arm; test's `spirv_asm{}` emits **`OpMemberDecorateId`** which ADCE annotation switch has no case for. **Genuinely new report.**
- `autodiff/coopvec.slang (vk)` — EXIT=134 @ -O3. Assert `folding_rules.cpp:3539 getFloatConstantKind`; CoopVec<float,4> float elem. Same fp-folding family as fp8, distinct site.
- `neural/outerproduct-accumulate-tiled-test.slang.2 (vk)` + `gfx-unit-test-tool/computeSmokeD3D12.internal` — COLLATERAL (isolated -O3 EXIT=0); dead-worker fallout from sibling aborts, not their own bugs.

**CLASS 1 — optimized SPIR-V no longer matches instruction-level FileCheck (~most of 79). BENIGN.** Sampled all EXIT=0; only fail FileCheck because spirv-opt legally rewrote output (folded bitcasts, inlined helpers, added/removed ArrayStride, changed OpEndPrimitive seq).

**CLASS 2 — non-semantic debug info removed/reshaped. BENIGN.** EXIT=0; DebugDeclare/DebugScope/OpName drift; some CHECK-NOT fire because opt introduces/preserves DebugInlinedAt.

## Approaches (advisory)
- **D (near-term, = jkwak's own plan):** expected-failure-list the 3 aborting tests under forced-opt (revive #11744 pattern) so #11988 nightly goes green; classify class-1/2 per intent (pre-SpvOpt→keep -O0-pinned FileCheck; post-SpvOpt→robust checks / spirv-val).
- **B:** conditional pass skip via existing `SLANG_ENABLE_SPIRV_OPT_MERGE_RETURN`-style toggle (disable AggressiveDCE for decoration case; CCP/Simplification for fp8). Recall #12204 (RegisterPassesFromFlags primitive).
- **C (long-term, root):** upstream spirv-tools fix (folder fp8; ADCE OpMemberDecorateId) — what #11766 waited on and never happened; slow/external.

Triager recommends TWO class-3 sub-issues (jkwak's call): (i) fp8/CoopVec float-const abort (fold sites :156+:3539; supersede/reopen #11766/#11767); (ii) OpMemberDecorateId ADCE assert.
