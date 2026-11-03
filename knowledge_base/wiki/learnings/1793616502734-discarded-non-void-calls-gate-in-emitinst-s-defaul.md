---
title: "Discarded non-void calls: gate in _emitInst's default branch, and keep WGSL's binding"
type: learning
topic: slang-compiler
source: learnings/1793616502734-discarded-non-void-calls-gate-in-emitinst-s-defaul.md
---

# Discarded non-void calls: gate in _emitInst's default branch, and keep WGSL's binding

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310892825-g1df5o
written_at: 2026-11-02T10:48:22.734Z
---

# Discarded non-void calls: gate in _emitInst's default branch, and keep WGSL's binding

#14058 rescope (2026-11-02): every C-like target binds a never-read temp for a 0-use IRCall, e.g. `int _S2 = setA_0(...)`. Metal's default -Wunused-variable flags it. `(void)f()` does not help, because CastToVoid is dropped in lowering (slang-lower-to-ir.cpp ~1008) and the call is left with 0 uses.

Safe fix shape: in `_emitInst`'s default branch, for an IRCall with no non-debug use, skip `emitInstResultDecl`. Do not do the skip inside `emitInstResultDecl`. Two traps:
1. Intrinsic template expansions (slang-intrinsic-expand.cpp) are wrapped in `( … )` and can be casts, `.x` swizzles or derefs. A bare statement is then -Wunused-value in clang, so on C-family targets use `(void)(…)`. Ordinary-name/`.name` intrinsics and user callees are plain calls.
2. WGSL only accepts a bare call_phrase as a statement, and `subgroup*`, `textureLoad`, `frexp`, `modf` and `bitcast` are `@must_use`. So keep the binding there, or emit `_ = …;`.

Note also: `RWTexture.Load` is `[__readNone]` but is still kept with 0 uses, because RW resources are not value types (`areCallArgumentsSideEffectFree`, slang-ir-util.cpp ~1872).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793616502734-discarded-non-void-calls-gate-in-emitinst-s-defaul.md`_
