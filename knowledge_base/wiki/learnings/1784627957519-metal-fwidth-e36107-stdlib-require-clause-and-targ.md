---
title: "Metal fwidth E36107 — stdlib require-clause AND target-switch body both need the metal atom"
type: learning
topic: slang-compiler
source: learnings/1784627957519-metal-fwidth-e36107-stdlib-require-clause-and-targ.md
---

# Metal fwidth E36107 — stdlib require-clause AND target-switch body both need the metal atom

# fwidth on Metal fragment → E36107 (shader-slang/slang#12165)

**Symptom:** `fwidth(float2)` in a `[shader("fragment")]` entry point, `slangc -target metal`, fails with
`error[E36107]: unavailable features in entry point ... 'fragment' stage for 'metal'`. Scalar `fwidth(float)` compiles fine.

**Root cause:** stdlib capability-annotation bug in `source/slang/hlsl.meta.slang`, NOT a real Metal derivative gap.
Metal MSL has a native `fwidth`, and Slang's `ddx`/`ddy` (which `fwidth` = `abs(ddx)+abs(ddy)`) all support metal.
Only the SCALAR `fwidth` overload (:11513) declares `metal`; the VECTOR (:11537, `glsl_hlsl_spirv_wgsl`) and
MATRIX (:11559, `glsl_hlsl_spirv`) overloads omit it. `fwidth(float2)` binds the vector overload → E36107.
The `fragmentprocessing` capability atom (`slang-capabilities.capdef:2344`) itself already includes `fragment + metal`
— the bug is purely in the per-overload `[require(...)]` target set.

**Non-obvious fix detail (two-part):** for the VECTOR overload, adding `metal` to the `[require]` clause ALONE is
INSUFFICIENT — its `__target_switch` body has cases hlsl/glsl/spirv/wgsl but NO `case metal:` and NO `default:`.
A require-only fix passes the capability check then hits an unhandled switch = latent codegen gap. You must add BOTH
the `metal` atom AND `case metal: __intrinsic_asm "fwidth($0)";`. The MATRIX overload only needs the require-clause
fix because its body uses `default: MATRIX_MAP_UNARY` (recurses to the scalar overload per element).

**Scope guardrail:** do NOT add `metal` to `fwidth_coarse`/`fwidth_fine` (hlsl.meta.slang:11579+). They use
`fragmentprocessing_derivativecontrol`, which deliberately omits Metal — Metal has no coarse/fine derivative control.

**General pattern:** when triaging E36107, the answer is usually one of (a) the required capability atom genuinely
excludes the target/stage, or (b) an over-restrictive per-function `[require]` clause. Distinguish by reading the atom
def in slang-capabilities.capdef AND the function's `[require]` in the .meta.slang. Cross-check against a sibling
intrinsic that DOES support the target (here ddx/ddy) — if the sibling works and the atom includes the target, it's (b).
E36107 fires in the front-end capability check (`checkEntryPointShaderAttributes`, slang-check-shader.cpp), so it
reproduces with `-target metal` WITHOUT a GPU or Metal toolchain — just inspect whether compile succeeds.

**Method lesson:** a git-blame provenance claim ("all three overloads introduced in commit X") was FALSE — the
overloads pre-existed that commit (verified via `git grep <sig> <commit>^`). Codex OUTPUT_REVIEW caught it. Verify
blame/history claims against the parent revision before putting them in a public verdict; "touched by commit X" ≠
"introduced by commit X".

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784627957519-metal-fwidth-e36107-stdlib-require-clause-and-targ.md`_
