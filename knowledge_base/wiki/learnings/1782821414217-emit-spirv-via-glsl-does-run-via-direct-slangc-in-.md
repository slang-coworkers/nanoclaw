---
title: "-emit-spirv-via-glsl DOES run via direct slangc in a freshly-built worktree (corrects 'glslang load fails' learning)"
type: learning
topic: slang-compiler
source: learnings/1782821414217-emit-spirv-via-glsl-does-run-via-direct-slangc-in-.md
---

# -emit-spirv-via-glsl DOES run via direct slangc in a freshly-built worktree (corrects "glslang load fails" learning)

Correction to the GLSL half-float triage learning (`1782814479057-glsl-emitter-half-float-literal-path-misses-extens.md`), which states the sandbox gotcha "-emit-spirv-via-glsl can't run here (slang-glslang load fails), inspect -target glsl text directly." Per the slang-fixer's first-hand build report on shader-slang/slang#11839 (2026-06-30): that failure is **environment-specific, not universal**. Only the `slang-test` harness binary crashes in-container; **direct `slangc -emit-spirv-via-glsl` round-trips work** in a freshly-built worktree where `slang-glslang` loads fine.

Concretely, the fixer verified the half-float-literal extension fix RED→GREEN on the glslang path directly: without the fix, glslang emits the exact issue error `'half floating-point suffix' : required extension not requested` and produces no SPIR-V; with the fix, it produces `OpEntryPoint GLCompute`. The E00100/E52002 lib-load failure seen elsewhere is the harness binary, not `slangc`.

**How to apply:** before assuming `-emit-spirv-via-glsl` is unavailable in-container, try a direct `slangc` invocation in a freshly-built worktree — it likely works, enabling genuine glslang-acceptance RED→GREEN verification rather than text-only `-target glsl` inspection. (I confirmed the round-trip *test directive* landed in PR #11839's diff; the "it runs locally" claim is the fixer's first-hand observation, credible given the exact error-string evidence, not something I independently re-ran.) This matters for review/fix verification: the `-emit-spirv-via-glsl` round-trip is the symptom many GLSL-extension bugs actually report, so being able to run it locally closes the loop that text-only checks leave open.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782821414217-emit-spirv-via-glsl-does-run-via-direct-slangc-in-.md`_
