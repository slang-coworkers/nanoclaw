---
title: "Migrating Slang code to slangpy 0.41 Tensor API — implementation gotchas + GPU-less compile-check"
type: learning
topic: slang-compiler
source: learnings/1781608041360-migrating-slang-code-to-slangpy-0-41-tensor-api-im.md
---

# Migrating Slang code to slangpy 0.41 Tensor API — implementation gotchas + GPU-less compile-check

Concrete gotchas when actually editing `.slang` for the slangpy 0.41 Tensor API migration (companion to the migration-rule learning):

1. **Braced-initializer-list indices stop working for 2-D+.** The new generic `load<I>/store<I>/add<I>` overloads do NOT infer the element type `I` from a braced list like `t.load({a, b})` or `g.add({y, x, idx}, v)` — you get `error[E39999]: not enough arguments to call`. 1-D `{a}` still resolves, but 2-D/3-D must be explicit vectors: `t.load(int2(a,b))`, `g.add(int3(y,x,idx), v)`, `output.store(uint2(px,py), v)`. Multi-arg subscript `t[y,x,idx]` still works fine.

2. **`GradInOutTensor.primal` accessor is gone.** After `GradInOutTensor→RWDiffTensor`, code like `t.primal.shape[0]` must become `t.shape[0]` (RWDiffTensor exposes a `shape` property) or `t._primal.shape[0]`. The struct fields are `_primal` (Tensor) and `_grad_out` (AtomicTensor).

3. **GPU-less compile-validation works and is worth doing.** A standalone `slangc` matching the bundled Slang version (find one at e.g. `/workspace/agent/slang-<ver>/bin/slangc`; version = `slangpy.SLANG_BUILD_TAG`) can front-end/semantic-check each `.slang` against the slangpy slang include path (`spy.SHADER_PATH`) WITHOUT a device:
   `slangc <file> -I <SHADER_PATH> -I <file-dir> -target spirv -o /dev/null`
   For functional-API shaders (no `[shader]` entry point) the ONLY expected error is the benign `error[E57004]: SPIR-V output contains no exported symbols` — treat that as PASS. This catches every accessor/type migration error (`E30027 member not found`, `E30015 undefined identifier`). It does NOT catch store-vs-add (both compile) — that's reasoning, not compile-time. Shaders importing the experimental `neural` module can't be standalone-compiled (`-experimental-feature` is not enough; the builtin module loads only via a live device).

4. **slangpy device creation can fail even with a GPU present** (Vulkan/CUDA "Failed to create device!") if the container lacks the Vulkan loader/ICD or CUDA libs — so "GPU visible in nvidia-smi" ≠ "can run samples". Plan for compile-check-only validation + draft PR.

5. **slangpy-samples CI runs `pre-commit --all-files`**, so a pre-existing lint issue anywhere on `main` (e.g. a file missing a trailing newline) reds out every PR's pre-commit check regardless of what the PR changed. Triage CI failures by which file/hook failed before assuming your diff caused it.

Context: slangpy-samples#43 → PR #46 (slangpy 0.42 / Slang 2026.5.2).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781608041360-migrating-slang-code-to-slangpy-0-41-tensor-api-im.md`_
