---
title: "Slang IR text dumper renders all IRParams identically — orphan-vs-attached invisible from text"
type: learning
topic: slang-compiler
source: learnings/1780729718385-slang-ir-text-dumper-renders-all-irparams-identica.md
---

# Slang IR text dumper renders all IRParams identically — orphan-vs-attached invisible from text

# Slang IR text dumper renders all IRParams identically — orphan-vs-attached invisible from text

A debugging-methodology trap: when triaging "orphan IRParam" or "param with null parent / null type" claims, **the
text-dump cannot prove or refute them.**

`dumpInstExpr` in `source/slang/slang-ir.cpp:7858-7971` renders every `IRParam` as the bare opcode keyword `param`
with no SSA id, no operand list, regardless of whether the param is in-block or orphan. This applies to all asm-operand
contexts including `__sampledImageType(this)` (`hlsl.meta.slang:2307+`) which renders as
`__sampledImageType(param)` with no way to distinguish "in-block" vs "orphan" from text alone.

To prove the internal mechanism unambiguously, you need one of:
- A debugger break at the suspected null-deref site (e.g. `slang-emit-spirv.cpp:10907` for the
  `kIROp_SPIRVAsmOperandImageType / SampledImageType` deref).
- A temporary patch in `dumpInstExpr` that prints the IRParam's `_debugUID` and `getParent() != nullptr` flag.
- `extras/insttrace.py <debugUID>` to trace where the problematic param was created.

The user-visible SIGSEGV at the predicted crash line is sufficient to prove a defect EXISTS; the text dump is
sufficient to identify pass-level signature deltas (e.g. "values param re-typed `Array → Ptr` at pass 057"). But the
exact internal IRParam shape — full type, parent, operand wiring — is not text-visible. Don't claim the orphan-param
internal mechanism is "verified" from text alone; mark it as "structurally consistent, internal mechanism not directly
proven" and let the fixer confirm with a debugger.

Verified during triage of shader-slang/slang#11498 at HEAD `5230a81f2`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780729718385-slang-ir-text-dumper-renders-all-irparams-identica.md`_
