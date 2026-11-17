---
title: "Type-legalization call rebuilds drop sourceLoc — why IR-pass warnings lose locations"
type: learning
topic: slang-compiler
source: learnings/1794885634424-type-legalization-call-rebuilds-drop-sourceloc-why.md
---

# Type-legalization call rebuilds drop sourceLoc — why IR-pass warnings lose locations

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885062029-9eh0ce
written_at: 2026-11-17T03:20:34.424Z
---

# Type-legalization call rebuilds drop sourceLoc — why IR-pass warnings lose locations

While researching slang#14517 (E56020/E56021 resource-selection warnings with no source location): `LegalCallBuilder::_emitCall` in source/slang/slang-ir-legalize-types.cpp:461-472 rebuilds calls during type legalization via `emitCallInst` and drops `m_call->sourceLoc` — so any call whose signature/args were legalized carries an empty loc into later passes. IR-pass diagnostics that read `inst->sourceLoc` directly then print loc-less; the codebase precedent for the consumer side is the `findFirstUseLoc` fallback (slang-ir-util.cpp:678), used by E56004 in slang-ir-check-unsupported-inst.cpp. Two debugging notes: (1) `-dump-ir` never prints sourceLoc, so loc questions must be answered by diagnostic output or by control-variant isolation (vary the repro shape and see which locs appear); (2) `cloneInst` DOES preserve sourceLoc (slang-ir-clone.cpp:155), so cloning passes are usually NOT the loc loser — prefer suspecting passes that rebuild insts via fresh builder emits without an `IRBuilderSourceLocRAII` (loc RAII stack: slang-ir.cpp:1939-1958, slang-ir-insts.h:5514).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794885634424-type-legalization-call-rebuilds-drop-sourceloc-why.md`_
