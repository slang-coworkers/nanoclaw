---
title: "Slang #12104: vec3 OpConstantComposite 4-constituent bug is in downstream spirv-opt, NOT Slang (x/x fold)"
type: learning
topic: slang-compiler
source: learnings/1784072018251-slang-12104-vec3-opconstantcomposite-4-constituent.md
---

# Slang #12104: vec3 OpConstantComposite 4-constituent bug is in downstream spirv-opt, NOT Slang (x/x fold)

shader-slang/slang#12104 — `output[0] = (value<eps) ? 0 : (value/value)` for a runtime float3 emits `OpConstantComposite %v3float %float_1 ×4` (invalid; vec3 needs 3). REPRODUCED at ToT. The maintainer (jkwak) filed it with leads pointing at Slang's own `processConstructor`/`emitCompositeConstruct`/`MakeVector` — those leads are WRONG. The bug is in the vendored downstream optimizer.

**How to prove the layer (reusable method for "invalid SPIR-V only at optimization" bugs):**
1. `slangc ... -dump-ir` — if the operation (here `div(%value,%value)`) survives intact through EVERY pass to the last, Slang IR is not folding it. Confirmed at both -O0 and default.
2. Compare `-O0` vs default output: `-O0` → correct `OpFDiv`; `-O1/2/3/default` → malformed constant. The ONLY pipeline delta is `slang-emit.cpp` `needsOptimization = getOptimizationLevel() != None` → routes SPIR-V through `PassThroughMode::SpirvOpt` (external/spirv-tools `spirv-opt`, vendored @ v2026.3). So the fold is in spirv-opt, not Slang.
3. `-fp-mode precise` → clean `OpFDiv ; NoContraction`; `-fp-mode fast` → malformed. Confirms an IEEE-unsafe fold (`x/x→1`; 0/0=NaN).
4. Width sweep: float2→4 constituents, float3→4, float4→4. The over-count is a HARDCODED 4, NOT a vec4→vec3 result-type shrink. The vec2-with-4 case is the cleanest smoking gun.
5. Contrast Slang's own folds: `v-v` folds correctly in Slang peephole (slang-ir-peephole.cpp:219, emitDefaultConstruct) to a 3-constituent zero-vector; `v*v` stays OpFMul; only `v/v` (which Slang leaves for spirv-opt — no x/x→1 rule in slang-ir-peephole/sccp) is mis-folded downstream.

**Fix options:** (A, true root) fix the fold rule in external/spirv-tools/source/opt/folding_rules.cpp to use the result type's component count, upstream + submodule bump; (B, in-tree, actionable now) add a fast-math-gated `x/x→1` fold in Slang peephole producing a correctly-sized ones vector, so spirv-opt never sees the vulnerable `OpFDiv %a %a`. NOTE: an emit-time constituent-count assert in emitOpConstantComposite does NOT catch this — the malformed const is created post-emit in spirv-opt, so a Slang-emit guard is only a general net, not a fix for this bug.

**General lesson:** when SPIR-V is invalid only at optimization levels, suspect the vendored downstream `spirv-opt` (external/spirv-tools) before Slang's emit — bisect by -O0 vs default and by -fp-mode, and confirm the op survives Slang IR via -dump-ir.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784072018251-slang-12104-vec3-opconstantcomposite-4-constituent.md`_
