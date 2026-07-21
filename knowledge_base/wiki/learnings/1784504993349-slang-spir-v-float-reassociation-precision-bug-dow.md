---
title: "slang SPIR-V float reassociation precision bug = downstream spirv-opt, not Slang IR (default fp-mode)"
type: learning
topic: slang-compiler
source: learnings/1784504993349-slang-spir-v-float-reassociation-precision-bug-dow.md
---

# slang SPIR-V float reassociation precision bug = downstream spirv-opt, not Slang IR (default fp-mode)

**Issue:** shader-slang/slang#12160 — `[ForceUnroll]` + `-target spirv` at default opt produced a numerically wrong result (`area[1]≈0.9869` vs `1.0`). SPIR-V showed an inexact folded constant `-0.999998987` replacing `(xmax - xmin)` where `xmin = min(...) - 1e-6`.

**Root cause (proven, and it OVERTURNED the static-analysis hypothesis):** NOT a Slang IR pass. Slang's own IR (`-dump-ir`) keeps the arithmetic exactly as written to emission — no folded constant anywhere. The IEEE-unsafe reassociation is done by the **bundled/vendored spirv-opt**, which runs ONLY when optimization level > `-O0` (`slang-emit.cpp:3329-3333`, `needsOptimization = getOptimizationLevel() != None`). Its add/sub folding rules (`external/spirv-tools/source/opt/folding_rules.cpp`, e.g. `MergeGenericAddSubArithmetic`/`MergeSubNegateArithmetic`) regroup `(a - b) - (b - k)` → `(a - b) + C` and fold `C = k - j` into one float constant → catastrophic cancellation when the true denominator is tiny. Every such rule is gated on `Instruction::IsFloatingPointFoldingAllowed()` (`external/spirv-tools/source/opt/instruction.cpp:830`) which returns `true` UNLESS the inst carries the `NoContraction` decoration.

**Diagnostic signature (fast triage — no GPU needed, just spirv-asm text):**
- `-O0` → correct; `-O1/2/3` → buggy  ⇒ the fold is in downstream spirv-opt, not Slang IR (`-O0` skips spirv-opt entirely).
- `-fp-mode precise` → correct; default/`fast` → buggy  ⇒ it's the `NoContraction` lever.
- `-dump-ir` still shows the original arithmetic ⇒ confirms Slang IR is innocent.
This is the SAME class as #12104 (vec3 4-constituent fold). When a SPIR-V precision bug appears only above `-O0`, suspect vendored spirv-opt first.

**Design intent (load-bearing for the verdict):** default fp-mode emitting NO `NoContraction` is INTENTIONAL — established by #11933 (added precise-mode NoContraction). Gate: `slang-emit-spirv.cpp:10265` emits `NoContraction` only when `mode == FloatingPointMode::Precise`. Regression test `tests/spirv/fp-mode-precise-nocontraction.slang:30-31` asserts `//DEFAULT-NOT: NoContraction` and `//FAST-NOT: NoContraction`. So Slang's contract: only `-fp-mode precise` guarantees no reassociation on the direct SPIR-V path. Verified workaround: `-fp-mode precise` fixes it at every opt level.

**Verdict pattern:** this is "default is more permissive than users expect," not a clear code bug. Recommend advisory + `-fp-mode precise` workaround; escalate "should DEFAULT permit result-changing reassociation or only FMA contraction?" as a maintainer design question. Do NOT unilaterally flip the #11933 default or its regression test.

**Method note:** to confirm the buggy arithmetic without a GPU, model it in float32 (Python `struct.pack('f',...)`). Reproduced the reporter's `0.9869` exactly (`Cj = f32(-1 + 1e-6) = -0.999998987`; `den = (1-0)+Cj = 1.0132790e-06` vs true `1e-6`; `a_val = 0.986895`) — ground-truth beats hand-waving.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784504993349-slang-spir-v-float-reassociation-precision-bug-dow.md`_
