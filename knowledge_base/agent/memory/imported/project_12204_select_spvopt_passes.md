---
name: project_12204_select_spvopt_passes
description: "#12204 select individual SpvOpt passes — SHIPPED. PR #12206 squash-merged 2026-07-28 (commit 335d24689409): versioned glslang_CompileRequest_1_3 ABI carries -Xspirv-opt flags → RegisterPassesFromFlags, additive to -OX, runs at -O0 when flags present; #11662 preserved."
metadata: 
  node_type: memory
  type: project
  originSessionId: 300c1234-7825-4e49-b006-b14e7b6ec619
---

# slang#12204 — select individual SpvOpt passes (SHIPPED)

**shader-slang/slang#12204** "Provide means to select SpvOpt" — enhancement/P3, jkwak-work
self-filed + self-assigned. ✅ **TERMINAL — PR #12206 squash-merged by jkwak-work 2026-07-28**
(merge commit `335d24689409`); issue auto-closed COMPLETED via `Fixes`. Worktree `wt-slang-12204`
reaped. No follow-up owed. Canonical thread `gh-issue-shader-slang/slang-12204`.

## What shipped (Approach B)
Before: `-OX` (0..3) was the only SPIR-V opt knob — each level a hard-coded pass preset
(`switch(optimizationLevel)` at `slang-glslang.cpp:316`). PR #12206 wires `-Xspirv-opt <arg>`
passthrough (the already-registered `SLANG_PASS_THROUGH_SPIRV_OPT` target) to SPIRV-Tools'
`Optimizer::RegisterPassesFromFlags` (SPIRV-Tools owns the flag vocabulary — no hand-maintained
table). Flags cross the slang-glslang C boundary via a new versioned ABI struct
`glslang_CompileRequest_1_3 : public glslang_CompileRequest_1_2` (byte-identical layout, verified by
offsetof probe + `is_trivially_copyable`/`is_base_of` static_asserts). **Additive to `-OX`.** No
Slang-side validator for the passthrough arg (consistent with `-Xdxc`), fail-on-partial-registration.
6 files, +test `tests/spirv/spirv-opt-passthrough.slang`; `pr: new feature` + `pr: non-breaking`.

**Approach A** (a new first-class `-spirv-opt-passes <a,b,…>` flag) was the triager's recommendation
but jkwak chose B ("sounds better", cmt 5061882883). **Approach C** (bulk `RegisterSizePasses`/
`RegisterPerformancePasses` presets) rejected — more presets, not per-pass control.

## Owner design reversal — run at `-O0`
Late in review (07-27, cmt 3659075623) jkwak reversed the "inert at `-O0`" behavior 6 rounds had
settled: `-Xspirv-opt` now runs spirv-opt **even under `-O0`** (`-O0 -Xspirv-opt` runs ONLY the
passthrough passes, no preset). ⚠️ **Load-bearing guardrail (held): the change is scoped to
flags-present**, so flag-less `-O0 -target spirv` still skips loading slang-glslang — preserving fix
**#11662** (single-module `-O0` fast path). Verified statically (`needsDownstreamCompiler` gate) +
empirically (plain `-O0` → slang-glslang not loaded, keeps OpName + un-inlined call; `-O0 -Xspirv-opt
--strip-debug` strips names but doesn't inline; `-O1 -Xspirv-opt` does both; invalid flag → exit 255).
Guarded by `gh-11662.slang`.

Review arc: 8 rounds (R1 3 gaps → R8 0 gaps + design-reversal), **0 bugs throughout**; APPROVED by
jkwak on head `6b128d9b46`, squash auto-merge armed, landed on green CI at `8c98e5bb2c`.

## Durable lessons (reusable beyond this issue)
- **`SLANG_ASSERT` compiles to `__builtin_assume` in release and ELIDES the guarded check** — codex
  caught that an `_invoke` pre-`1_3`-downgrade guard written as an assert would drop the null-check in
  release builds; it was made an unconditional best-effort-diagnostic fail instead. (Recorded as a
  shared learning.)
- **Rebuild the core-module headers before trusting `tests/spirv/` results against a prebuilt slangc.**
  An `internal-spirv-asm-opname-prefix.slang` failure (emitted `%dotResult`, expected `%__dotResult`)
  was a STALE PREBUILT BINARY artifact, not a master regression: the on-disk slangc predated the
  `__`-prefix fix ([[project_12108_spirv_asm_internal_name_prefix]], PR #12190, commit 72985f871) that
  embedded the rename + test into the core module at compile time. Proven both directions (stale→fail;
  `cmake -E touch hlsl.meta.slang` + `generate_core_module_headers` rebuild @HEAD→PASS). No issue filed.
- **A branch-update/push on an APPROVED PR dismisses the approval (and disarms auto-merge).** The fixer
  correctly held — no branch-touch, no flake-notes — once approved + auto-merge armed; merge/BEHIND
  resolution is operator/merge-queue-gated.

**Related:** PR #12187/#11988 = slang-test `-OX` at test-harness level
([[project_11988_nightly_spvopt_workflow_parked]]); the recurring `test-falcor` red during review was
the catalogued `GBufferRTTexGrads_d3d12` flake
([[project_12145_gbufferrttexgrads_d3d12_access_violation]]), PR-code-independent (byte-identical
Falcor codegen), non-required check.
