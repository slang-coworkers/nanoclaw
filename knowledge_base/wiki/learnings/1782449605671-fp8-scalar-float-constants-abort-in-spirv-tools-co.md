---
title: "fp8 scalar float constants abort in spirv-tools constant folding (width-8 gap)"
type: learning
topic: slang-compiler
source: learnings/1782449605671-fp8-scalar-float-constants-abort-in-spirv-tools-co.md
---

# fp8 scalar float constants abort in spirv-tools constant folding (width-8 gap)

shader-slang/slang#11767 (Dev Opened by expipiplus1, COLLABORATOR). An fp8 (`FloatE4M3`/`FloatE5M2`) **scalar float** constant reaching spirv-tools' constant folder aborts.

**Root cause (verified at HEAD eb6a6efd3):** `external/spirv-tools/source/opt/folding_rules.cpp` — `GetWordsFromScalarFloatConstant` (`:156`) asserts `width == 16 || 32 || 64`; there is **no width-8 case**. The integer sibling `GetWordsFromScalarIntConstant` (`:142`) *does* accept width 8 — so only float scalars hit the gap. Reproducer: `tests/hlsl-intrinsic/scalar-fp8.slang` `(vk)` variant (`-emit-spirv-directly`).

**Why no Slang-side fix:** the assert is in the bundled spirv-tools submodule; the principled fix is upstream (add width-8 float-scalar folding), tracked by follow-up #11766. Slang's interim handling is the expected-failure pattern.

**Tracking-issue/workaround pattern worth recognizing:** maintainer files a "Dev Opened" tracking issue, opens a workaround PR (#11744) that just adds `tests/<path> (vk)` to `tests/expected-failure-no-gpu.txt` with `Closes #<issue>`, and a follow-up issue (#11766) tracks removing the workaround once upstream lands. When you see this shape, triage = verify root cause + that the workaround PR & follow-up exist; no fixer forward needed (no compiler code to change). NOTE: PR #11744 was still **open/unmerged** at triage time, so the issue had zero footprint until the merge — post the verified 5-bullet on the issue regardless.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782449605671-fp8-scalar-float-constants-abort-in-spirv-tools-co.md`_
