---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788249332526-y9k3ch
written_at: 2026-09-02T12:36:08.307Z
---

# Slang record-replay: wrapObject<T> must be instantiated with a COM *interface* type, never a concrete impl class (else UBSan bad-downcast)

**Context:** shader-slang/slang PR #12863 (record-replay). A CI sanitizer (UBSan) job failed with a bad-downcast even though the plain Debug build + all unit tests were green (85/85). The functional behavior was correct; only UBSan flagged it.

**The trap:** `slang-record-replay` has TWO `wrapObject`s:
1. Free function `SLANG_API ISlangUnknown* wrapObject(ISlangUnknown*)` (`proxy-base.h`) — does the actual `tryWrap`.
2. A *type-safe template* `template<typename T> T* wrapObject(T* obj)` (`replay-context.h`) that does `toSlangInterface<T>(wrapObject(toSlangUnknown(obj)))` — i.e. after wrapping it QIs the resulting proxy **back to T via `T::getTypeGuid()`**.

When you call `wrapObject(somePtr)`, overload resolution prefers the **template** (exact match) over the free function (which needs a base-pointer conversion). So `wrapObject(new ReplayNullFileSystem())` deduces `T = ReplayNullFileSystem` — a *concrete implementation class*, not a COM interface. `ReplayNullFileSystem::getTypeGuid()` still compiles (inherited from a base interface), so it builds and even runs — but `toSlangInterface<ReplayNullFileSystem>` then does `result->release()` on the returned `MutableFileSystemProxy` through a `ReplayNullFileSystem*` static type. The vtable dispatch happens to land on the right `release()` (so tests pass), but it is a **member call on a pointer to the wrong dynamic type = UB**, which `UndefinedBehaviorSanitizer` reports as a bad-downcast (`replay-shared.h:105`).

**Rule:** Always pass an **interface-typed** pointer to `wrapObject`/`unwrapObject`, so `T` is a COM interface with a genuine `getTypeGuid()` and the QI-back is well-defined. E.g.:
```cpp
ISlangMutableFileSystem* standIn = new ReplayNullFileSystem();
desc2.fileSystem = wrapObject(standIn);   // wrapObject<ISlangMutableFileSystem> — OK
```
not `wrapObject(new ReplayNullFileSystem())` (deduces the concrete type → UB). The working arms already do this (`wrapObject(OSFileSystem::getMutableSingleton())` → `ISlangMutableFileSystem*`; `wrapObject(desc.fileSystem)` → `ISlangFileSystem*`).

**Broader lessons:**
- A UBSan/ASAN CI failure can hide behind a fully-green Debug build + passing tests — vtable dispatch can mask an invalid downcast. Don't assume "tests pass ⇒ no UB." When CI's sanitizer job fails but local Debug is green, suspect exactly this class of static-vs-dynamic-type UB.
- Dead code that a new test first executes can surface *multiple* latent bugs at once (here: a leak **and** this bad-downcast both lived in the never-run `new NULLFileSystem()` arm).
