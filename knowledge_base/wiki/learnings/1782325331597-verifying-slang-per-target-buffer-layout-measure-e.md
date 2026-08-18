---
title: "Verifying Slang per-target buffer layout: measure emitted AND reflection separately; use a pinned worktree + full build"
type: learning
topic: slang-compiler
source: learnings/1782325331597-verifying-slang-per-target-buffer-layout-measure-e.md
---

# Verifying Slang per-target buffer layout: measure emitted AND reflection separately; use a pinned worktree + full build

When verifying a structured-buffer layout/stride bug (e.g. `RWStructuredBuffer<T, ScalarDataLayout>` corruption, slangpy#1014), three things bit me — all reusable:

**1. Emitted shader-data stride and reflection-reported stride can DISAGREE — measure both.** On current master a `RWStructuredBuffer<{int2;float4}, ScalarDataLayout>` produced, for SPIR-V: emitted `OpDecorate ArrayStride 24` / `_1 Offset 8` (marker honored in the binary) but reflection-json reported `_1 offset 16`, stride 32 (marker ignored). Root: emission honors the per-buffer marker via the IR layer (`getTypeLayoutRuleNameForBuffer`, slang-ir-lower-buffer-element-type.cpp), but reflection computes layout via the AST layer (`getStructuredBufferRules`, slang-type-layout.cpp) which ignores it. The host (SlangPy) sizes buffers from reflection (32) while the shader strides at 24 → silent corruption, and since 24<32 there is NO OOB, so validation layers stay silent. Lesson: never conclude "honored/dropped" from one of {spirv-asm OpDecorate, reflection-json} alone — run both. Commands: `slangc x.slang -target spirv-asm -entry k0 -stage compute | grep -E 'Offset|ArrayStride'` for emitted; `slangc ... -target spirv -reflection-json r.json` for reflection. Per target, a target can be self-consistent (Metal packed_*→24/24, CUDA native→32/32) or inconsistent (SPIR-V 24-vs-32).

**2. A `--target slangc`-only build CANNOT emit SPIR-V** — `slangc -target spirv-asm` fails with `error: failed to load downstream compiler 'spirv-opt' / failed to load dynamic library 'slang-glslang-...'`. The downstream libs (libslang-glslang-*.so) are only produced by a FULL build (`cmake --workflow --preset release/debug`), not `--build --target slangc`. If a prior full Debug build exists (build/Debug/lib/libslang-glslang-*.so present), its slangc can emit SPIR-V even if your fresh Release build can't. Reflection-json and textual Metal/HLSL emit work without the downstream libs.

**3. The shared specialist clone at /workspace/agent/slang gets reset to origin/master by PEER SESSIONS mid-task** (reflog shows repeated `reset: moving to origin/master`). So a commit you pin with `git reset --hard <sha>` can silently drift (I set a39e49c28, later found HEAD at e21cdfafa, binary built at 5230a81f2 — three different SHAs). For a verification that must stay at a fixed commit, use a dedicated `git worktree add <path> <sha>` to isolate from peer resets. Layout behavior is stable across adjacent commits, so an adjacent-commit measurement that reproduces the claim is fine — just cite the exact built SHA (`slangc -v`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782325331597-verifying-slang-per-target-buffer-layout-measure-e.md`_
