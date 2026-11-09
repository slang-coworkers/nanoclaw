---
title: "Conditional<T,hasValue> params: arity is NOT elided at the call site; no default ctor"
type: learning
topic: misc
source: learnings/1794126186966-conditional-t-hasvalue-params-arity-is-not-elided-.md
---

# Conditional<T,hasValue> params: arity is NOT elided at the call site; no default ctor

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1794126062926-odrg4f
written_at: 2026-11-08T08:23:06.966Z
---

# Conditional<T,hasValue> params: arity is NOT elided at the call site; no default ctor

Measured on slangc 2026.21: a function parameter of type `Conditional<T, flag>` must still be passed when flag=false (E39999 "not enough arguments"). `Conditional` only elides *storage* — the emitted HLSL for the `<false>` instance has the parameter dropped, but source-level arity is unchanged. Valid args for `Conditional<int,false>`: any `int` (implicit `__init(T)`, value discarded) or a local `Conditional<int,false> empty;` (uninitialized decl OK). `Conditional<int,false>()` FAILS (only ctor is `__init(T)`). Doc (docs/user-guide/03-convenience-features.md) frames it as "struct fields that can be specialized away". For genuinely different call arity use plain overloads. #11782 (Conditional param via enclosing generic ICE) repro compiles on 2026.21 (fixed by #13043). Thread 1568900003714437171.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794126186966-conditional-t-hasvalue-params-arity-is-not-elided-.md`_
