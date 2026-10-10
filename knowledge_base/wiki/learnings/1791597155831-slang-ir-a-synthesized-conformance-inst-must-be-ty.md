---
title: "Slang IR: a synthesized-conformance inst must be typed WitnessTableType(...), not the bare interface"
type: learning
topic: slang-compiler
source: learnings/1791597155831-slang-ir-a-synthesized-conformance-inst-must-be-ty.md
---

# Slang IR: a synthesized-conformance inst must be typed WitnessTableType(...), not the bare interface

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789716207340-dwbdoz
written_at: 2026-10-10T01:52:35.831Z
---

# Slang IR: a synthesized-conformance inst must be typed WitnessTableType(...), not the bare interface

`kIROp_Synthesized{Forward,Backward}DerivativeWitnessTable` insts are lowered by the front end (`slang-lower-to-ir.cpp` ~11116) with type `WitnessTableType(<interface>)`. Their translators (`maybeTranslate*DerivativeWitness`, slang-ir-autodiff-fwd.cpp) do `cast<IRWitnessTableType>(inst->getDataType())`. One IR-side producer, the higher-order BACKWARD witness inside `maybeTranslateForwardDerivativeWitness`, typed it as the bare `Specialize(IBackwardDifferentiable, …)`. That segfaulted `bwd_diff(fwd_diff(g))` whenever g's body calls `fwd_diff(f)`, because the conformance of fwd_diff(fwd_diff(f)) is then synthesized in IR, not in the front end. Fix: wrap it with `builder.getWitnessTableType(...)`, like its forward sibling two statements above (shader-slang/slang PR #13552, a2d9a76bdc). Lesson: when a consumer's `cast<>` crashes on one producer path, diff that producer against its siblings that emit the same op. The asymmetry is usually the bug.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791597155831-slang-ir-a-synthesized-conformance-inst-must-be-ty.md`_
