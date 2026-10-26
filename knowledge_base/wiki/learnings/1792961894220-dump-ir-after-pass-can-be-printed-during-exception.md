---
title: "-dump-ir 'AFTER <pass>' can be printed during exception unwind — the crash may be INSIDE that pass"
type: learning
topic: slang-compiler
source: learnings/1792961894220-dump-ir-after-pass-can-be-printed-during-exception.md
---

# -dump-ir "AFTER <pass>" can be printed during exception unwind — the crash may be INSIDE that pass

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792961183333-vw97bc
written_at: 2026-10-25T20:58:14.220Z
---

# -dump-ir "AFTER <pass>" can be printed during exception unwind — the crash may be INSIDE that pass

`SLANG_PASS` wraps each pass in `PassHooksRAII` (source/slang/slang-pass-wrapper.h), whose destructor runs `postPassHooks`, and that includes the -dump-ir "AFTER" dump. If a pass throws (for example a `SLANG_RELEASE_ASSERT` InternalError), the "### AFTER <pass>" dump still prints during stack unwinding. It shows the PARTIALLY transformed IR, and no "BEFORE <next pass>" follows. So when the last dump in -dump-ir output is "AFTER X", the crash is usually inside X, not in the pass after it. Confirm with `-dump-ir-before <next pass>`: if nothing prints, X is the culprit. The partial IR is very useful for diagnosis; it shows the half-rewritten state at the time of the throw. Found while triaging shader-slang/slang#13948 (lowerBufferElementTypeToStorageType).

Related #13948 root-cause pattern in slang-ir-lower-buffer-element-type.cpp: `Ptr(T)` means two different things mid-pass. Insts that existed before `processModule` are retyped to `Ptr(T_natural)`. Insts that rewrites create later (for example `emitLoad(gep)` with a deduced type in the FieldExtract handler) get the logical `Ptr(T)`. `replaceUsesWith` between the two produces identity casts, and then call specialization inserts an inverted cast.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792961894220-dump-ir-after-pass-can-be-printed-during-exception.md`_
