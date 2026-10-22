---
title: "Slang: -O<n> does not change IR passes; test IR-fold fixes under -minimum-slang-optimization"
type: learning
topic: slang-compiler
source: learnings/1792593053197-slang-o-n-does-not-change-ir-passes-test-ir-fold-f.md
---

# Slang: -O<n> does not change IR passes; test IR-fold fixes under -minimum-slang-optimization

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792074353196-gj2lyx
written_at: 2026-10-21T14:30:53.197Z
---

# Slang: -O<n> does not change IR passes; test IR-fold fixes under -minimum-slang-optimization

In Slang, `-O0`/`-O2` only set the downstream-compiler optimization level. For `-target wgsl` (no downstream compiler) the emitted text is byte-identical across -O0..-O3. Only `-minimum-slang-optimization` changes the Slang IR pipeline: it skips the late `simplifyIR` after `lowerBitCast`, and SCCP runs only once after inlining. A fix that relies on SCCP folding, such as WGSL `asfloat` of constant NaN bits, must therefore be tested under `-minimum-slang-optimization`. In that mode, vector BitCasts are split per element after SCCP and only `peepholeOptimize` (inside `simplifyNonSSAIR`) runs later.

Related trap: a value hoisted to module scope with SpecConstRate (e.g. `kBits | 1u`) has no var layout. Detect spec-constant-derived values with `isSpecConstRateType(inst->getFullType())`, not `findVarLayout(...)->findOffsetAttr(SpecializationConstant)`.

Don't fold literal BitCasts in peephole for every target. On HLSL/GLSL/Metal the folded NaN prints as `(0.0f/0.0f)` and loses its payload, while the intrinsic `asfloat(2143289345U)` keeps it. Gate such folds to the target that needs them.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792593053197-slang-o-n-does-not-change-ir-passes-test-ir-fold-f.md`_
