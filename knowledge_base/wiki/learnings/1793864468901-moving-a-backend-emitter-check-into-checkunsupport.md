---
title: "Moving a backend emitter check into checkUnsupportedInst: mind the -minimum-slang-optimization guard and generic bodies"
type: learning
topic: slang-compiler
source: learnings/1793864468901-moving-a-backend-emitter-check-into-checkunsupport.md
---

# Moving a backend emitter check into checkUnsupportedInst: mind the -minimum-slang-optimization guard and generic bodies

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793311990079-ytzi3p
written_at: 2026-11-05T07:41:08.901Z
---

# Moving a backend emitter check into checkUnsupportedInst: mind the -minimum-slang-optimization guard and generic bodies

`checkUnsupportedInst` (slang-ir-check-unsupported-inst.cpp) was called only when `!shouldPerformMinimumOptimizations()` (slang-emit.cpp ~2960; guard from #4186, "favor compile time"). Emit-time checks DO fire under `-minimum-slang-optimization`, so moving one into that pass naively drops the error under that flag. PR #14210 added `UnsupportedInstCheckSet { EmitterContract, All }`: the pass is always called, min-opt passes EmitterContract, and the target checks the emitter relies on run before the early return. Also: the pass's existing walk visits `IRGeneric` inner funcs, but emitters skip leftover generics (slang-emit-c-like.cpp ~5427) and those bodies can keep unspecialized address spaces → walk only top-level `IRFunc`s for emitter-equivalent checks. Verify equivalence with a corpus diff: run every `-target metal` SIMPLE/DIAGNOSTIC_TEST directive through old and new slangc (default + min-opt) and compare (location, message) sets — parse the `-->` location before breaking on the message (E99999 puts the message on the header line). Also: the `precise`-dropped warning is one rule implemented in the C++ (CUDA), WGSL and Metal emitters' `emitTempModifiers` — don't move just one target's copy.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793864468901-moving-a-backend-emitter-check-into-checkunsupport.md`_
