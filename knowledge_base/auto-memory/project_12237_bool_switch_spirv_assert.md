---
name: project_12237_bool_switch_spirv_assert
description: "slang#12237 — bool-typed switch condition asserts in SPIR-V emit; triaged+verified, fixer HELD pending skiminki-nv go-ahead"
metadata: 
  node_type: memory
  type: project
  originSessionId: 89834e8d-6c39-4d6d-92ba-35a6d1326350
---

# slang#12237 — Boolean switch condition asserts during SPIR-V emission

**State (2026-07-27):** Triaged & VERIFIED at HEAD `70462843c`; `reproduced` label applied. Fixer HELD — NO PR, NO dispatch — pending author explicit "make a PR" go-ahead. Verdict posted: https://github.com/shader-slang/slang/issues/12237#issuecomment-5094773828 (comment id 5094773828).

**Author:** skiminki-nv (MEMBER/maintainer, self-filed). Classic self-file/self-defer pattern (cf. [[project_12223_debug_build_og_debuggability]], [[project_12222_lexer_lone_utf8_continuation_byte]]) — wants a PR only on explicit `@nv-slang-bot Create a PR`. That go-ahead webhook routes back through Main → dispatch slang-fixer on thread `gh-issue-shader-slang/slang-12237` with Approach A.

**Bug:** `switch (b)` with bool condition + `case true:`/`case false:` → `assert failure: slang-emit-spirv.cpp: intLit` (line 5435 at HEAD; 5340 in reporter's older a4168d47c6). SPIR-V-ONLY — HLSL/GLSL/CUDA/Metal/CPU all EXIT=0. Category bug / medium / P2 / target-emit(SPIR-V). NOT a regression.

**Root cause (empirical, -dump-ir):** switch condition stays `bool`, case values stay `IRBoolLit` to emit. `as<IRIntLit>(caseValue)` returns null → assert. Producer `getIntValue(boolType,…)` mints `IRBoolLit` not `IRIntLit` (`slang-ir.cpp:2439`, `kIROp_BoolType → kIROp_BoolLit`). `processSwitch()` in SPIR-V legalize (`slang-ir-spirv-legalize.cpp:1694`) never normalizes the type. OpSwitch requires integer selector + integer-literal case values.

**Approach A (recommended fix):** In `processSwitch()`, when condition is `IRBoolType`, insert `IRIntCast` bool→int on the condition (emitter already lowers this via SpvOpSelect at `slang-emit-spirv.cpp:9171`) and rebuild the switch with integer case values (`true`→1, `false`→0). Mirror WGSL legalize's `legalizeSwitch` rebuild pattern (`slang-ir-wgsl-legalize.cpp:126-151`). Add SPIR-V regression test (no existing coverage for bool-switch). Approach B (lower-time, target branch — rejected, shared path). Approach C (relax emit assert — rejected, band-aid).

**Caveats:** DeepWiki claim that bool switch is pre-normalized before SPIR-V emit is CONTRADICTED by the dump — do not rely on it. WGSL also emits `case true:` and compiles locally but its spec requires int selectors too — latent adjacent issue, OUT OF SCOPE, note only.

**Triage memo:** triager's `triage-12237.md` (fixer should request it on go-ahead).
