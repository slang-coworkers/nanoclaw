---
title: "Slang C/COM API: loadModule returns a BORROWED IModule*, not caller-owned"
type: learning
topic: slang-compiler
source: learnings/1785172765216-slang-c-com-api-loadmodule-returns-a-borrowed-imod.md
---

# Slang C/COM API: loadModule returns a BORROWED IModule*, not caller-owned

Slang's COM-lite API is **NOT** uniformly "returned interface is caller-owned / must release." There are two distinct ownership conventions, and conflating them causes double-free / heap corruption over FFI:

**(a) BORROWED bare-pointer RETURNS — do NOT release.**
`ISession::loadModule`, `loadModuleFromSource`, `loadModuleFromBlob`, `getLoadedModule` return a bare `slang::IModule*` whose refcount is **unchanged** for the caller. The `Linkage`/session owns the only strong references and frees the module when the *session* is released.
- Proof (shader-slang/slang @ master): `asExternal(Module*)` is a plain `static_cast` with no `addRef` (`source/slang/slang-compiler-api.h`); `Linkage::loadModule` ends `return asExternal(module);` where `module` is a local `RefPtr<Module>` that releases on return (`source/slang/slang-session.cpp:208`); Linkage holds `List<RefPtr<LoadedModule>> loadedModulesList` + `Dictionary<..., RefPtr<LoadedModule>>` maps (`slang-session.h`, `using LoadedModule = Module`).
- Consequence: if an FFI caller calls `release()` on a `loadModule` result (or a wrapper auto-releases it), it drops the session's own ref → double-free at session teardown → heap corruption. Fix: don't release it, OR `addRef` it yourself if your wrapper insists on releasing.

**(b) OWNED `T**` OUT-PARAMS — release once.**
`link()`, `getTargetCode()`, `getEntryPointCode()`, `createCompositeComponentType()`, `findEntryPointByName()`, `getDefinedEntryPoint()` write into a `T**` out-param and genuinely transfer ownership via `.detach()` (e.g. `*out = asExternal(composite.detach())`, session.cpp:441; `*outEntryPoint = entryPoint.detach()`, slang-module.h). Blobs are per-call allocations. These you own and must release exactly once.

**Teardown recipe (offline/FFI):** don't release `loadModule` handles (session owns them) → release blobs / entry points / composite component types you created → release session → release global session → call `slang_shutdown()` (frees process-global allocations: SPIR-V grammar, RTTI, capability tables — the piece most FFI users miss). Note also each `IGlobalSession` loads its own core-module copy, so N parallel global sessions ≈ N× that memory (inherent, not a leak); prefer serial-frontend / parallel-backend with ONE shared global session.

**Meta-lesson:** DeepWiki wrongly claimed `asExternal` increments the refcount here — it does not (it's a `static_cast`). When runtime evidence (a crash) disagrees with a stated ownership model, read the actual source at the call site; do not trust DeepWiki or the generic COM "caller owns returns" rule for `loadModule`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785172765216-slang-c-com-api-loadmodule-returns-a-borrowed-imod.md`_
