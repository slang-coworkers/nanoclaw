---
name: project_12237_bool_switch_spirv_assert
description: "slang#12237 — bool-typed switch condition asserts in SPIR-V emit; triaged+verified, fixer HELD pending skiminki-nv go-ahead"
metadata: 
  node_type: memory
  type: project
  originSessionId: 89834e8d-6c39-4d6d-92ba-35a6d1326350
---

# slang#12237 — Boolean switch condition asserts during SPIR-V emission

**State (2026-07-29): ✅✅ MERGED — CHAIN TERMINAL (Main-verified).** skiminki-nv merged PR #12254 at 10:32:44Z, merge commit `1eeb3b29d8`; issue #12237 auto-closed `completed` via `Fixes #12237`. Both maintainers signed (jkwak LGTM + skiminki APPROVED @172da98c32==head); all CI green (test-falcor rerun cleared transient `Unknown VCS root` infra — not code). **Fix:** shared `legalizeBoolSwitchForKhronos(IRModule*)` in `linkAndOptimizeIR`'s GLSL/SPIRV/SPIRVAssembly block — bool switch condition→int cast + `IRBoolLit` case values→`IRIntLit`, covering BOTH direct-SPIR-V and GLSL/via-GLSL emit; Khronos-gated (HLSL/Metal/CUDA/CPU unchanged). Fixer reaped wt-slang-12237 + branch + sentinel.
- **Arc lesson (router):** initial fix was SPIR-V-emitter-pass-only → passed direct-spirv but CI's `-emit-spirv-via-glsl` vk step stayed RED (`glslang 'case': scalar integer required`). Main caught it (babysitter-flagged, Main-verified deterministic on 2 platforms, NOT flake) despite fixer's initial infra-flake framing → fixer re-layered to the shared linkAndOptimizeIR pass (one source of truth before both emit paths). Same verify-the-red-belongs-to-this-PR discipline as #12202.
- **Follow-up spun off:** #12260 (`enum : bool` switch → E39999, pre-existing target-indep front-end gap) at skiminki's request → routed to slang-triager 07-29. lang-ver-gate design Q resolved in PR's favor (skiminki endorsed legalize-don't-reject).

**07-29 CI-red root-cause + refix:** original fix (`d831288914` `normalizeBoolSwitch`) was SPIR-V-pass-only; CI vk step `-emit-spirv-via-glsl` (+ `-target glsl`) routes through the GLSL emitter, which printed `case true:` literally → glslang reject. Refix pushed head `172da98c32` (non-draft): shared **`legalizeBoolSwitchForKhronos()`** in `linkAndOptimizeIR` — one source before both GLSL+SPIRV emit, Khronos-gated. Local all-green (direct-spirv + via-glsl EXIT 0, GLSL now emits `switch(int)`, 6/6 new test incl vk-via-glsl, 19/19 switch suite); codex re-approved. Two-layer fix validated in real CI — the 2 previously-failing vk test-slang jobs now pass.

**lang-ver-gate design Q — RESOLVED in PR's favor:** skiminki (07-29 09:22Z) endorses legalize-don't-reject; no change needed.

**SPUN OFF → #12260** (07-29 09:24Z, at skiminki's "file a separate issue"): `switch on 'enum : bool' fails E39999 could not extract value from integer constant` — fixer verified on master `6dba5d2120`, target-indep (spirv/hlsl/cpp), pre-existing, NOT caused by #12254. Routed to slang-triager. #12254 stays scoped to the plain-bool fix. See [[project_12260_enum_bool_switch_e39999]].

**Prior state (2026-07-28):** DRAFT PR #12254 OPEN — https://github.com/shader-slang/slang/pull/12254 (`Fixes #12237`, `pr: non-breaking`, commit `d831288914`). Double-authorized: jkwak-work ("Make a PR", comment 5097205861) + skiminki-nv ("Do as jkwak asks", comment 5104724338). Fixer DONE + codex-APPROVE on all 3 gate stages.

**Reviews:**
- slang-reviewer (bot): Reviewer B/Devin 0/0/0; C 0 correctness + 2 clarity nits; reviewer's own independent source verification = NO bugs (operand rewrite safe — switch is non-hoistable terminator, IRUse::set() in place idiomatic; new getCaseValueUse(i) offset correct; 32-bit int selector valid; SLANG_ASSERT(boolLit) invariant sound — front end coerces case exprs to condition type slang-check-stmt.cpp:425). Reviewer A (correctness/auto-postable) still running as of 14:10Z; consolidated combined-review.md pending. Reviewer gh-write BLOCKED (OneCLI GitHub not connected → patch-mode fallback off git fetch; file-only delivery, no post-authorized marker anyway).
- HUMAN maintainer (07-28 23:38Z): jkwak-work reviewed "It looks good to me" + assigned skiminki-nv to review/approve. Raised ONE open design Q: "may want to make bool-switch an error based on Slang language version — not sure what the plan is." Fixer replied on PR (comment 5110920503, source-verified): bool IS a currently-valid switch-condition type (`isScalarIntegerType` treats bool as scalar int, slang-check-decl.cpp:12044; works on all non-SPIR-V targets today) — this PR only closes the SPIR-V codegen gap, does NOT change the language. No conflict with sibling #12238/#12246 (that rejects *float* via isValidCompileTimeConstantType which bool satisfies; complementary — mine legalizes bool, #12246 rejects float). Making bool a diagnostic = deliberate lang-version-gated decision, ORTHOGONAL to this fix; offered separate follow-up if maintainers want it. Left direction to jkwak+skiminki. No code change.

**Awaiting:** skiminki-nv formal review/approve. Merge/ready-flip OPERATOR-GATED (drafts-only guardrail). Fixer owns further PR webhooks (verdict/inline/CI). Triage verdict earlier posted: comment 5094773828, `reproduced` label applied.

**Open design thread (watch, not blocking this PR):** whether bool switch conditions should eventually be a language-version-gated diagnostic. Maintainer decision (jkwak+skiminki), separate follow-up if pursued.

**Fix (commit d831288914, 2 src +31, 1 test +37):** `normalizeBoolSwitch()` at top of `processSwitch()` in `slang-ir-spirv-legalize.cpp` — casts bool switch condition → int (`IRIntCast`, emitter lowers via `OpSelect(cond,1,0)`), rewrites each `IRBoolLit` case value → `IRIntLit` (true→1/false→0) in place. New `IRSwitch::getCaseValueUse(i)` accessor. Verified: repro EXIT 0 (was 255) → `OpSelect` + `OpSwitch`; `SLANG_RUN_SPIRV_VALIDATION=1` passes; new test 4/4; broader switch suite (17) unchanged.

**Author:** skiminki-nv (MEMBER/maintainer, self-filed). Classic self-file/self-defer pattern (cf. [[project_12223_debug_build_og_debuggability]], [[project_12222_lexer_lone_utf8_continuation_byte]]) — wanted a PR only on explicit go-ahead, which arrived from BOTH maintainers.

**Bug:** `switch (b)` with bool condition + `case true:`/`case false:` → `assert failure: slang-emit-spirv.cpp: intLit` (line 5435 at HEAD; 5340 in reporter's older a4168d47c6). SPIR-V-ONLY — HLSL/GLSL/CUDA/Metal/CPU all EXIT=0. Category bug / medium / P2 / target-emit(SPIR-V). NOT a regression.

**Root cause (empirical, -dump-ir):** switch condition stays `bool`, case values stay `IRBoolLit` to emit. `as<IRIntLit>(caseValue)` returns null → assert. Producer `getIntValue(boolType,…)` mints `IRBoolLit` not `IRIntLit` (`slang-ir.cpp:2439`, `kIROp_BoolType → kIROp_BoolLit`). `processSwitch()` in SPIR-V legalize (`slang-ir-spirv-legalize.cpp:1694`) never normalizes the type. OpSwitch requires integer selector + integer-literal case values.

**Approach A (recommended fix):** In `processSwitch()`, when condition is `IRBoolType`, insert `IRIntCast` bool→int on the condition (emitter already lowers this via SpvOpSelect at `slang-emit-spirv.cpp:9171`) and rebuild the switch with integer case values (`true`→1, `false`→0). Mirror WGSL legalize's `legalizeSwitch` rebuild pattern (`slang-ir-wgsl-legalize.cpp:126-151`). Add SPIR-V regression test (no existing coverage for bool-switch). Approach B (lower-time, target branch — rejected, shared path). Approach C (relax emit assert — rejected, band-aid).

**Caveats:** DeepWiki claim that bool switch is pre-normalized before SPIR-V emit is CONTRADICTED by the dump — do not rely on it. WGSL also emits `case true:` and compiles locally but its spec requires int selectors too — latent adjacent issue, OUT OF SCOPE, note only.

**Triage memo:** triager's `triage-12237.md` (fixer should request it on go-ahead).
