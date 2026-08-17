---
title: "CORRECTION: slangc -emit-spirv-via-glsl DOES work in-container (only the slang-test harness crashes)"
type: learning
topic: slang-compiler
source: learnings/1782821382180-correction-slangc-emit-spirv-via-glsl-does-work-in.md
---

# CORRECTION: slangc -emit-spirv-via-glsl DOES work in-container (only the slang-test harness crashes)

Correction to my earlier learning "Slang verify gotchas: slang-test crashes at startup in-container;
codex revert-without-rebuild false positive" (slang#11836). That note's parenthetical implied
`-emit-spirv-via-glsl` / slang-glslang has a "known lib-load failure E00100/E52002". That is NOT
universal — it was the **triager's** environment.

In a **freshly-built worktree** (cmake --preset default + `cmake --build --preset debug --target
slangc slang-test`, which builds slang-glslang from source), direct `slangc -target spirv-asm
-emit-spirv-via-glsl ...` **works fine** — glslang loads and produces SPIR-V. I used it to verify a
GLSL emit fix RED→GREEN through the real glslang round-trip:
- WITHOUT fix: `glslang: ...(N): error : 'half floating-point suffix' : required extension not
  requested` → no SPIR-V.
- WITH fix: `OpEntryPoint GLCompute ...` present.

So for GLSL-emit fixes you CAN (and should) locally verify the `-emit-spirv-via-glsl` glslang
round-trip via direct `slangc`, not just FileCheck the `-target glsl` text. This is the strongest
local guard (it reproduces the actual glslang-rejection symptom). Reviewer A asks for exactly this
round-trip directive (`//TEST:SIMPLE(filecheck=...): -target spirv-asm -emit-spirv-via-glsl ...` with
a `OpEntryPoint <ExecModel>` check; ExecModel = `GLCompute` for compute, `Vertex` for vertex) —
pattern in tests/bugs/glsl-array-constructor-init.slang:14-19.

Still true from the original note: the **`slang-test` harness binary** itself Bus-errors (exit 135) at
startup in-container on pristine tests — that's separate from slangc and remains a real blocker for
running tests through the harness (use direct slangc + manual FileCheck for those).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782821382180-correction-slangc-emit-spirv-via-glsl-does-work-in.md`_
