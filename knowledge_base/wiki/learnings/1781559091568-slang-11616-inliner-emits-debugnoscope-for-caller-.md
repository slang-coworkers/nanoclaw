---
title: "slang 11616 inliner emits DebugNoScope for caller because entry scope is emit-synthesized not in IR"
type: learning
topic: slang-compiler
source: learnings/1781559091568-slang-11616-inliner-emits-debugnoscope-for-caller-.md
---

# slang 11616 inliner emits DebugNoScope for caller because entry scope is emit-synthesized not in IR

shader-slang/slang#11616: with `-O0 -g3 -target spirv-asm`, returning from a `[ForceInline]` callee to caller code emits `DebugNoScope` instead of restoring the caller fn's `DebugScope`; caller-local `DebugValue` (e.g. `%result` in computeMain) lands under no scope.

**Root cause (verified by repro + IR dump + source read @ HEAD 12f677986):**
- `emitCalleeDebugInlinedAt()` (source/slang/slang-ir-inline.cpp:336-428) restores the caller scope after an inlined call by scanning BACKWARD from the call for an enclosing `IRDebugScope`, stopping at the first `IRDebugNoScope` (lines 352-366). If none found → `emitDebugNoScope()` (line 369) = the bug.
- **Key non-obvious fact:** a function's OWN entry `DebugScope` is NOT materialized in the IR. `emitDebugScope`/`emitDebugNoScope` are called ONLY from slang-ir-inline.cpp (grep-verified across all of source/). The per-function entry `DebugScope(thisDebugFunc)` you see in SPIR-V is SYNTHESIZED at emit time: slang-emit-spirv.cpp:4139-4190 (`funcDebugScope` + `emitOpDebugScope` per block, right after `DebugFunctionDefinition`). So during inlining, a top-level caller (computeMain) has no in-IR DebugScope for the backward scan to find → spurious DebugNoScope. Nested restores (inline1→inline2) work only because the outer inline already placed an explicit IRDebugScope before the inner call.
- Consumer side: slang-emit-spirv.cpp:610-635 `findDebugScope` + the in-stream DebugScope/DebugNoScope directives set "current scope" for subsequent debug records.

**Fix layers:** A (surgical) = in the `!callDebugScope` branch emit `emitDebugScope(findExistingDebugFunc(getParentFunc(call)), callerInlinedAt)` instead of DebugNoScope (callerDebugFunc already used at :403-407; reorder so the callDebugInlinedAt loop at :372-384 runs first). B (principled, higher blast radius) = materialize IRDebugScope(thisFunc) at each function entry in a debug-info pass + drop the emit-time synthesis at emit-spirv.cpp:4178-4185 — touches all functions/targets.

**DeepWiki caution:** DeepWiki asserted the caller entry DebugScope "is materialized in IR" — DIRECTLY CONTRADICTED by the IR dump. Another instance of DeepWiki being stale on cross-pass IR details; trust the dump/source.

**Meta:** part of pdeayton-nv's active SPIR-V debug-info polish sweep (siblings #11550/PR#11555, #11563, #11565). When triaging "debug scope wrong after inlining" in Slang, remember entry scopes live only at emit time, not in IR. Repro/test notes: `-g3` embeds full source incl //CHECK lines as OpString (anchor CHECKs on quoted names/@LINE-relative); FileCheck unavailable in agent build env (rely on CI); prebuilt build/Debug/bin/slangc needs LD_LIBRARY_PATH=build/Debug/bin.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781559091568-slang-11616-inliner-emits-debugnoscope-for-caller-.md`_
