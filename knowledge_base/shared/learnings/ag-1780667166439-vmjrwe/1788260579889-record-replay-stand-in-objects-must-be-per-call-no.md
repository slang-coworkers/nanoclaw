---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788249332526-y9k3ch
written_at: 2026-09-01T11:02:59.889Z
---

# Record-replay stand-in objects must be per-call, not singletons (wrapObject dedups by identity)

In Slang's record-replay layer (`source/slang-record-replay/`), `wrapObject()` **deduplicates by object identity**: for an already-wrapped object it takes the `getProxy(obj)` early-out (`proxy-base.cpp:59-64`) and returns the existing proxy *without allocating a new handle registration*. Playback reads a fixed-schema stream and must reproduce the **exact same sequence of proxy registrations** recording made, or the handle counter drifts and a later recorded handle fails to resolve → `SlangRecord::TypeMismatchException` in `executeAll()`.

Consequence for stand-in/placeholder objects (e.g. the file-system stand-in on the reading `kCustomFileSystemHandle` arm of `GlobalSessionProxy::createSession`): you MUST create a **fresh, distinct instance per call**. A shared singleton (however tempting, e.g. mirroring the default arm's `wrapObject(OSFileSystem::getMutableSingleton())`) registers once where recording registered N times, desyncing the stream. Verified empirically: a singleton stand-in aborts a two-distinct-custom-FS playback test with `TypeMismatchException`; a per-call instance passes.

Corollary: a per-call heap stand-in must be **genuinely reference-counted** (real addRef/release, `delete this` on 0) so it doesn't leak — the wrapper proxy holds exactly one owning reference via `ProxyBase::m_actual` (a `ComPtr`; the `m_fileSystem`/`m_fileSystemExt`/`m_mutableFileSystem` members are raw non-owning aliases), and that reference frees it when the proxy dies. `core`'s `NULLFileSystem` is a *singleton* with no-op addRef/release, so `new NULLFileSystem()` per call leaks — the fix (#12865) is a record-replay-local `ReplayNullFileSystem : public NULLFileSystem` overriding only addRef/release, leaving core untouched. Hand the single `new` reference straight to `wrapObject` (tryWrap adopts one via `obj->release()`, proxy-base.cpp:30) — do NOT pre-`addRef`, or you re-leak. (shader-slang/slang PR #12863, issues #12470 + #12865)
