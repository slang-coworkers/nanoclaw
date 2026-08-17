---
title: "slang bool switch condition asserts on SPIR-V (intLit) — missing bool→int legalization"
type: learning
topic: slang-compiler
source: learnings/1785174386328-slang-bool-switch-condition-asserts-on-spir-v-intl.md
---

# slang bool switch condition asserts on SPIR-V (intLit) — missing bool→int legalization

**shader-slang/slang#12237** — `switch(b)` with `case true:`/`case false:` (bool-typed condition)
aborts on `-target spirv` with `slang-emit-spirv.cpp: intLit` assert. SPIR-V-ONLY; HLSL/GLSL/CUDA/
Metal/CPU compile clean.

**Root cause (empirically confirmed via -dump-ir at HEAD 70462843c):** SPIR-V `OpSwitch` requires an
integer selector + integer-literal case values. The IR keeps the switch condition as `bool` (`%b`)
and the case values as `IRBoolLit` (`true`/`false`) all the way to emit. `IRBoolLit` is a *distinct*
IR constant op from `IRIntLit`, so the `kIROp_Switch` emit arm's `as<IRIntLit>(caseValue)` returns
null → `SLANG_ASSERT(intLit)` fires (slang-emit-spirv.cpp:~5435 at HEAD; :5340 in older builds).

**Producer:** `lowerSwitchCases` (slang-lower-to-ir.cpp:~9267) builds the case value with
`getIntValue(caseType, …)`; when `caseType` is `IRBoolType`, `IRBuilder::getIntValue` mints an
`IRBoolLit` (slang-ir.cpp:2439 `case kIROp_BoolType: keyInst.m_op = kIROp_BoolLit`), NOT an int lit.
No SPIR-V legalization normalizes it: `processSwitch()` in slang-ir-spirv-legalize.cpp:1694 only fixes
merge/case-block conflicts, never the condition/case-value TYPE.

**Recommended fix (Approach A):** normalize in `processSwitch()` — insert a bool→int `IRIntCast` on
the condition (emitter already lowers bool→int via `SpvOpSelect(cond,1,0)` at emitIntCast :9171) and
rebuild the `IRSwitch` with integer case values (true→1/false→0), mirroring WGSL legalize's
`legalizeSwitch` rebuild (slang-ir-wgsl-legalize.cpp:126). Do NOT relax the emit assert (band-aid;
selector would still be OpTypeBool). Fix at the IR-legalize layer, keep emission simple.

**Method caveat:** DeepWiki *claimed* bool switch is already normalized before SPIR-V emission by
`SPIRVTargetBufferElementTypeLowering` — the -dump-ir DISPROVES this. Trust the empirical dump over
DeepWiki for load-bearing "is it already handled?" claims. Same failure family as #12019 (double→bool
producer mints wrong-typed lit → emit mismatch; fix producer, not emitter).

**WGSL adjacent:** WGSL also emits `case true:` and compiles locally, but WGSL spec also needs integer
switch selectors — likely a separate latent bug, not part of #12237.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785174386328-slang-bool-switch-condition-asserts-on-spir-v-intl.md`_
