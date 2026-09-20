---
title: "Slang release builds: SLANG_ASSERT compiles to SLANG_ASSUME — a post-assert 'safety guard' is NOT release-safe"
type: learning
topic: slang-compiler
source: learnings/1789870012032-slang-release-builds-slang-assert-compiles-to-slan.md
---

# Slang release builds: SLANG_ASSERT compiles to SLANG_ASSUME — a post-assert "safety guard" is NOT release-safe

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789818528557-wme74h
written_at: 2026-09-20T02:06:52.032Z
---

# Slang release builds: SLANG_ASSERT compiles to SLANG_ASSUME — a post-assert "safety guard" is NOT release-safe

**Trap that fooled a full 3-reviewer pipeline + two of my own passes on shader-slang/slang#13182.**

In `source/core/slang-common.h` (~:363-371): `#ifdef _DEBUG` → `SLANG_ASSERT` is a real assert; **`#else` → `#define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)`**, and `SLANG_ASSUME(X)` is `[[assume(X)]]` / `__builtin_assume(X)` / `__assume(X)` (and GCC's `if(!X) __builtin_unreachable();`).

**Consequence:** the common defensive idiom
```cpp
SLANG_ASSERT(in.type == Object);
if (in.type != Object || in.rangeIndex == 0) return empty;   // "safe fallback"
```
is **safe only in debug**. In release the assert becomes `__builtin_assume(in.type == Object)`, so the optimizer is entitled to **delete the `in.type != Object` half of the very next guard** — the "fallback" can be optimized away and the code falls through into type-confusion / OOB / UB. Do **not** reason "assert fires in debug, guard catches it in release" — the guard may not exist in release.

**Reviewer takeaways:**
- When a helper does `SLANG_ASSERT(precondition)` then appears to also guard the same precondition, that guard does NOT protect release builds. If the input can be out-of-contract (esp. client-controlled / `LSPAny` / untrusted), require a *real* check (`getKind() == Object`) before the asserting call, not `SLANG_ASSERT` + a redundant `if`.
- Concrete instance: `JSONContainer::getObject()` asserts `type==Object`; `JSONValue::isObjectLike()` is `Index(type) >= Index(Type::Array)` — **true for arrays too**. So routing an `LSPAny` (e.g. `initializationOptions: [1]`) through an `isObjectLike()`-gated `getObject()` is release UB. Guard with `getKind() != Object → return`.
- Process note: I initially mis-scoped this as "release-safe, optional nit." An independent codex OUTPUT_REVIEW round caught the SLANG_ASSUME semantics and I had to retract an APPROVE → REQUEST_CHANGES. The critique gate earned its keep here; when a "safe fallback after an assert" is load-bearing to a verdict, verify the assert macro's release expansion before calling it safe.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789870012032-slang-release-builds-slang-assert-compiles-to-slan.md`_
