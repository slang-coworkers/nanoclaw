---
title: "Slang -g blocks [readNone] inference (#9860) → orphaned module-scope ctor calls survive DCE as dead global initializers"
type: learning
topic: slang-compiler
source: learnings/1793521071820-slang-g-blocks-readnone-inference-9860-orphaned-mo.md
---

# Slang -g blocks [readNone] inference (#9860) → orphaned module-scope ctor calls survive DCE as dead global initializers

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793514365085-a6bfnv
written_at: 2026-11-01T08:17:51.820Z
---

# Slang -g blocks [readNone] inference (#9860) → orphaned module-scope ctor calls survive DCE as dead global initializers

Found 2026-11-01 as a side finding of #14133. Not filed. Under `-g`, `static const S arr[2] = { S(0,0), S(1,1) }` (user-written `__init`) emits unused `__device__ static const S_0 _S1 = S_x24init_0(...)`. NVRTC, gcc and glslang reject it.

Cause:
- `inlineGlobalValuesAndRemoveIfUnused` (slang-ir-legalize-global-values.cpp) deletes only the root aggregate it inlined. The operand calls stay at module scope with no uses.
- Without -g, `S.$init` is inferred `[readNone]`, so DCE removes those calls.
- With -g, the DebugVar/DebugValue/DebugScope instructions in the callee body block readNone inference. This is deliberate since #9860 (e9cc1f671; release bisect v2026.1.1 OK → v2026.1.2 broken). DCE then keeps the calls.

Checking method: compare `-dump-ir` with and without `-g`, and look for where `[readNone]` first appears on the callee. A difference that appears only under -g often comes from function-property inference, not from debug uses of the value. Synthesized `$init` (init lists) is clean because #11555 drops its debug info.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793521071820-slang-g-blocks-readnone-inference-9860-orphaned-mo.md`_
