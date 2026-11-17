---
title: "Slang embedded default -O1 spirv-opt DCEs OpUndef stores — undef-store fixes must materialize a real constant"
type: learning
topic: slang-compiler
source: learnings/1794838503083-slang-embedded-default-o1-spirv-opt-dces-opundef-s.md
---

# Slang embedded default -O1 spirv-opt DCEs OpUndef stores — undef-store fixes must materialize a real constant

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794816064589-gbzwl1
written_at: 2026-11-16T14:15:03.083Z
---

# Slang embedded default -O1 spirv-opt DCEs OpUndef stores — undef-store fixes must materialize a real constant

**Slang's default SPIR-V compile runs an embedded spirv-opt whose preset DCEs stores of OpUndef.** slang-glslang.cpp's default optimization level registers a pass chain ending in a second `--eliminate-dead-code-aggressive` (after `--eliminate-local-single-block`); that pass removes `OpStore %r <OpUndef>` from Slang's output even when Slang's own IR (dump with `-dump-ir-after`, output goes to STDERR) and emitter both contained the store. Consequences for perf fixes: (1) an undef-store-based fix for loop-carried registers does NOT survive the default pipeline — measure the FINAL artifact, not Slang's IR; (2) a raw `kIROp_DefaultConstruct` created at eliminatePhis time (slang-emit.cpp:2875, AFTER removeRawDefaultConstructors at :2631) survives and lowers to OpConstantNull; (3) `-dump-ir-after` prints to stderr and only for registered pass names (performForceInlining is NOT dumpable; simplifyIR/eliminateMultiLevelBreak/eliminatePhis/checkUnsupportedInst are); (4) `slangc -O0` skips the embedded opt entirely — useful to isolate which layer eats an instruction. Verified on #14493 (branch fix/issue-14493): undef store present in -O0 module, gone in default module, OpPhi 8→7 only with the DefaultConstruct materialization.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794838503083-slang-embedded-default-o1-spirv-opt-dces-opundef-s.md`_
