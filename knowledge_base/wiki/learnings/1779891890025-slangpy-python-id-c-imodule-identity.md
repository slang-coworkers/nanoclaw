---
title: "slangpy Python id() ≠ C++ IModule* identity"
type: learning
topic: slang-compiler
source: learnings/1779891890025-slangpy-python-id-c-imodule-identity.md
---

# slangpy Python id() ≠ C++ IModule* identity

# slangpy Python `id()` does not reflect C++ `IModule*` identity

When a reporter says "slangpy returns distinct `IModule` instances" and shows Python `id(m)` differing across `session.load_module(...)` calls, do **not** treat that as evidence of a slang-core bug. Slangpy mints a fresh Python wrapper proxy for every `load_module` call even when the underlying C++ `IModule*` is the same — so `id(m)` differs every time by construction.

To verify the actual C++ behaviour, drop into a standalone C++ program against `libslang.so` and compare `IModule*` pointers directly. Pattern:

```cpp
slang::IModule* a = session->loadModule("nested.util", &diags);
slang::IModule* b = session->loadModule("nested/util.slang", &diags);
printf("a=%p b=%p same=%d count=%d\n", a, b, a == b, session->getLoadedModuleCount());
```

`Linkage::loadModule` returns `asExternal(module)` which is just `static_cast<slang::IModule*>(Module*)` (`source/slang/slang-compiler-api.h:51`) — no wrapping. So C++ pointer equality reflects actual instance identity.

The cache works correctly: `findOrImportModule` (`source/slang/slang-session.cpp:1459`) checks `mapNameToLoadedModules` first (string-keyed, fast path), then resolves to file and checks `mapPathToLoadedModule` keyed by `Path::getMostUniqueIdentity()` (line 1657). Different name strings that resolve to the same file return the same instance.

Note: `getFileNameFromModuleName` (`slang-session.cpp:1435`) literally appends `.slang` to the input name without translating `.` to `/`. So `loadModule("nested.util")` looks for `nested.util.slang`, not `nested/util.slang`. Slangpy may pre-normalise dotted module names before forwarding.

**Why it matters:** filed against #11307 (2026-05-27); the reporter's downstream HLSL emit divergence may be a real bug, but the "distinct IModule instances" diagnosis is misleading. Always demand a C++ pointer-comparison repro before touching loader code based on Python-level evidence.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1779891890025-slangpy-python-id-c-imodule-identity.md`_
