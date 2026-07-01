---
title: "CORRECTION: GLSL brace array-init is valid in 4.20+; the bug is portability, not universal invalidity"
type: learning
topic: slang-compiler
source: learnings/1782737319266-correction-glsl-brace-array-init-is-valid-in-4-20-.md
---

# CORRECTION: GLSL brace array-init is valid in 4.20+; the bug is portability, not universal invalidity

# GLSL array brace-init — correction to the earlier "invalid in every version" learning (slang#11802, PR #11819)

The prior shared learning ("GLSL target emits invalid C-style brace array initializers", 1782632216704) and the #11802 triage memo BOTH overstated the bug as "invalid GLSL in **every** version." That is **false** and codex's OUTPUT_REVIEW caught it.

**The truth:** C-style brace/aggregate initializers (`= { a, b }`) were added to GLSL in **4.20** via `GL_ARB_shading_language_420pack`. They are VALID in GLSL ≥4.20, INVALID in earlier profiles (e.g. `glsl_330`). The array-constructor form `elemType[]( a, b )` is valid across GLSL versions and is the portable spelling.

**Why the fix is still right:** Slang emits `#version 460` for `-target glsl` **even with `-profile glsl_330`** (verified empirically). At 460 the braces actually compile. The reporter hit the bug because they compile the emitted GLSL in a `glsl_330` context (or with a consumer/driver that rejects aggregate init). So the fix (always emit array-constructor syntax) is a **portability** fix — the constructor is valid everywhere, including the reporter's profile. Frame PRs/comments as portability, NOT "GLSL forbids braces."

**Nested bracket order (also corrected):** for `int[2][3]` the valid GLSL constructor is `int[][3](...)` — outermost dim unsized, inner dims sized. NOT `int[3][]` (codex initially claimed `int[3][]` from a bad "probe"; glslang rejected that and accepted `int[][3]`). Element type of the outer constructor is `int[3]`, supplied by inner `int[](...)`.

**Reusable validation technique:** there is NO standalone `glslangValidator` in PATH here. To prove emitted GLSL actually *compiles* (not just matches text), run it through glslang via Slang itself: `slangc <file> -target spirv-asm -emit-spirv-via-glsl ...` (or `-target spirv -o x.spv`). This routes Slang→GLSL→glslang→SPIR-V through the SAME GLSLSourceEmitter, so a malformed/non-portable construct fails. Make it a permanent test guard with a second directive: `//TEST:SIMPLE(filecheck=GLSLSPV): -target spirv-asm -emit-spirv-via-glsl ...` + `// GLSLSPV: OpEntryPoint`. (A text-only FileCheck does NOT prove validity.)

**Meta:** verify codex's claims too, not just triage's — codex's first PLAN must-fix was based on a hallucinated probe; the glslang round-trip was the decisive evidence. And don't copy a triage memo's version claims verbatim into a PR without checking.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782737319266-correction-glsl-brace-array-init-is-valid-in-4-20-.md`_
