---
type: triage
---
# Triage: shader-slang/slang#14535 — HLSL cooperative matrix: invalid element type or scope aborts with ICE (exit -2)
Date: 2026-11-17 | Category: bug | Severity: medium | Priority: P2 | Component: target-emit (HLSL) | Duplicate: no

## What's broken
On `-target hlsl`, invalid cooperative-matrix input triggers `SLANG_RELEASE_ASSERT` in
`source/slang/slang-emit-hlsl.cpp` → E99997 + slangc exit -2 instead of clean exit -1.
Three sites, all verified on master (slangc rebuilt first: `2026.13.1-50-g3649fb982`):
- `:2088` `componentType` — BFloat16 element type → E55208 diagnosed, then assert, exit -2. **Repro'd.**
- `:2092` `matrixScope` — `MemoryScope.Device` → E55209 diagnosed, then assert, exit -2. **Repro'd.**
- `:1601` `saturatingAccumulation` — `coopMatMulAdd<..., true>` on HLSL → **no prior diagnostic at all**, straight assert, exit -2. **Repro'd** (worse than the other two: nothing but E99997).

The expression path (`:1579-1584`, CastFloatToInt on CoopMat) already handles the same
diagnosed-nullptr results gracefully — it is the in-file model to mirror.

## Repro
```
cat > repro.slang << 'SL'
using namespace linalg;
[shader("compute")]
void probe()
{
    var mat = CoopMat<BFloat16, MemoryScope.Subgroup, 16, 16, CoopMatMatrixUse::MatrixA>(BFloat16(1.0));
}
SL
build/Release/bin/slangc repro.slang -target hlsl -entry probe -stage compute
# → E55208 + E99997 assert slang-emit-hlsl.cpp(2088): componentType, exit 254 (-2)
```
Scope variant: replace element type with `float`, scope with `MemoryScope.Device` → E55209 + assert at :2092.
Saturation variant: `coopMatMulAdd<float, true, half, half, float, MemoryScope.Subgroup, 16, 16, 16>(a,b,c)` → assert at :1601, no diagnostic.

## Codebase digest (file:line)
- `slang-emit-hlsl.cpp:2070-2109` — CoopMatrixType type-emission path: helpers diagnose + return nullptr, then `SLANG_RELEASE_ASSERT(componentType)` `:2088`, `(matrixScope)` `:2092`, `(matrixUse)` `:2095`; literal-operand assert `:2080`.
- `slang-emit-hlsl-prelude.cpp:305-346` — `getCoopMatComponentTypeName`: BFloat16 → diagnoses E55208, returns nullptr; other unknowns → `SLANG_UNEXPECTED` (true invariant, keep).
- `slang-emit-hlsl-prelude.cpp:363-384` — `getCoopMatMatrixScopeName`: Device/CrossDevice (and any non-Subgroup/Workgroup/Invocation) → diagnoses E55209, returns nullptr.
- `slang-emit-hlsl.cpp:1570-1593` — expression path: `if (!componentType || !matrixUse) return true;` after diagnosis. The graceful pattern.
- `slang-emit-hlsl.cpp:1596-1613` — `CoopMatMulAdd`: `SLANG_RELEASE_ASSERT(!saturatingAccumulation && ...)` `:1601`, no diagnostic before it.
- Diagnostics: `slang-diagnostics.lua:6211-6223` (E55208 `unsupported-coop-mat-element-type-for-hlsl`, E55209 `unsupported-coop-mat-scope-for-hlsl`). No "saturating accumulation for HLSL" diagnostic exists yet — fix must add one.
- Exit-code mapping (verified on #14433/#14519): exit -2 = `SLANG_E_ABORT` after E99997 (`slang-end-to-end-request.cpp`); exit -1 = ordinary failed compile; sink error count at end of emission fails the compile → -1.
- PR #14519 (CUDA sibling, open draft, head c036fc580, fix/issue-14433): removes `SLANG_RELEASE_ASSERT(false)` after diagnosing in `emitWMMAFragmentType`, returns `SLANG_FAIL`, callers handle it (emit operand, return true); `CPPSourceEmitter::_getTypeName` adds `SlangInvalidType` placeholder + no-silent-failure check; adds `tests/cooperative-matrix/cuda-coop-mat-diagnostics.slang` entries. Touches only CUDA/CPP emitters — `HLSLSourceEmitter` derives from `CLikeSourceEmitter`, NOT `CPPSourceEmitter`, so #14535 still reproduces on that PR branch.
- DeepWiki (2 Q&A): no IR pass owns target-specific coopmat support validation; by current design these checks live in the emitters (CUDA `emitWMMAFragmentType`, Metal `_validateCoopMatrixType`, HLSL these helpers). `validateVectorsAndMatrices` does not cover it.
- Tests: no HLSL coopmat diagnostics test exists; `tests/cooperative-matrix/bfloat16.slang` shows BFloat16 coopmat is valid on other targets (vk/cuda) — i.e. genuine target-specific unsupported input, not malformed input.

## Candidate approaches
### Approach A: Mirror #14519 in the HLSL emitter (recommended)
- Where: `slang-emit-hlsl.cpp:2088` / `:2092` — drop the asserts on the two diagnosed-nullptr results; on null, keep emitted declarations syntactically valid (placeholder text, mirroring #14519's `SlangInvalidType`) or return early; `:1601` — replace assert with a new diagnostic (e.g. `saturating-accumulation-for-hlsl`, next free 552xx ID) + graceful bail.
- Behaviour delta: invalid element type/scope/saturation → E55208/E55209/(new) + exit -1; no E99997.
- Tradeoffs: minimal diff, consistent with the in-review #14519 precedent, stays at the layer that currently owns target-support checks. Compile fails via sink error count, so placeholder text never reaches downstream consumers.
- Risk: low. Keep `:2080`/`:1576` literal-operand asserts and `SLANG_UNEXPECTED` defaults — those are genuine compiler invariants (lowering must produce literal operands).
### Approach B: Front-load into an IR validation pass
- Where: target-aware coopmat type validation pass before emit (the TODO at `slang-emit-cuda.cpp:1791` anticipates exactly this).
- Behaviour delta: diagnostics fire pre-emit with the user's source location (today E55208 points at `hlsl.meta.slang:30270`, not user code — poor UX); emitter asserts become true unreachable invariants.
- Tradeoffs: more principled long-term, better loci, but bigger blast radius, cross-target coordination, no landed precedent.
- Risk: medium.
### Approach C: Skip emission once sink has errors
- Too broad — changes behavior for all diagnostics, may mask emission bugs. Not recommended.

## Recommended path
Approach A — fastest correct fix that doesn't regress adjacent surfaces, and matches the
precedent currently in review (#14519). Approach B is a good follow-up enhancement (also fixes
the diagnostic locus); it should not block this fix. Flag: the fixer should decide placeholder
vs early-return in the type path (void-returning `emitType` context — #14519 chose placeholder
in the analogous `_getTypeName` slot).

## Acceptance criteria
- All three repros: expected diagnostic (E55208 / E55209 / new saturation diagnostic) and exit -1; no E99997.
- New test `tests/cooperative-matrix/hlsl-coop-mat-diagnostics.slang` mirroring `cuda-coop-mat-diagnostics.slang` (DIAGNOSTIC_TEST:SIMPLE, `-target hlsl`): BFloat16 → E55208, Device scope → E55209, saturating accumulation → new ID.
- `tests/cooperative-matrix/` HLSL/existing suites stay green.

## Sources
- Local code: slang-emit-hlsl.cpp, slang-emit-hlsl-prelude.cpp, slang-diagnostics.lua, hlsl.meta.slang (read 2026-11-17, master 3649fb982)
- PR #14519 diff (gh pr diff), issue #14433 chain memos (memory/issues/14433.md, triage-14433.md)
- DeepWiki Q&A: emitter error-propagation design; coopmat validation ownership
- Repro verified 2026-11-17 on rebuilt master slangc
