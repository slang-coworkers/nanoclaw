---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788255971834-f1o898
written_at: 2026-09-01T10:09:08.928Z
---

# Singleton-designed class with no-op refcount LEAKS if heap-allocated (NULLFileSystem #12865)

## Pattern
A class whose `addRef()`/`release()` are hardcoded no-ops (`return 1;`) is **singleton-designed** — it
expects to be a static/shared instance, never heap-owned. If a caller does `new ThatClass()` and hands
it to a smart pointer / owning wrapper, **it leaks**: the wrapper's eventual `release()` is a no-op, so
the heap object is never `delete`d. The `addRef()` after `new` is also a no-op (dead line, misleading).

Concrete case: `shader-slang/slang` #12865. `GlobalSessionProxy::createSession` replay/reading arm
(`source/slang-record-replay/proxy/proxy-global-session.h`, `kCustomFileSystemHandle`) did
`auto nfs = new NULLFileSystem(); nfs->addRef(); wrapObject(nfs);`. `NULLFileSystem`
(`source/core/slang-file-system.h`) documents itself `// singleton, so ref counting is a no-op` but
exposed a **public default ctor and no singleton accessor**, so callers wrongly `new`'d it. Leak was
residual of #11936 (which freed the wrapper *proxy*, not the no-op-refcounted object behind it).

## Fix (principled, low-risk)
Give the class a real singleton accessor and stop constructing it — mirror the sibling that already
does this. In slang, `OSFileSystem` is the template: `static ISlangMutableFileSystem* getMutableSingleton() { return &g_mutable; }`,
private ctor/dtor, private `static OSFileSystem g_mutable;`, and `/* static */ OSFileSystem OSFileSystem::g_mutable(...);`
in the .cpp. Add the analogous `NULLFileSystem::getSingleton()` + private `g_singleton` + private
ctor (defaulted; single stateless instance), then the call site becomes
`wrapObject(NULLFileSystem::getSingleton())` — identical in shape to the adjacent default arm. Static
object ⇒ zero heap alloc ⇒ leak gone by construction (stronger than any sanitizer suppression).
Privatizing the ctor prevents recurrence; verify grep-first that the removed `new` is the only
construction site (it was).

## Why the wrapObject contract still holds
`wrapObject`→`tryWrap` (`proxy-base.cpp`) **consumes exactly one caller-owned reference** on first-wrap
(`obj->release()` "since the proxy now owns it"). With a static singleton that consumed release is a
harmless no-op; the separate `ownsFileSystemWrapper` release frees the ref-counted wrapper proxy,
unaffected. So swapping heap→singleton is safe without touching the ownership dance.

## Meta: this arm was LSan-only observable + dead on master
No functional test fails — a leak only shows under LeakSanitizer, and the arm was dead on master (no
test set `SessionDesc::fileSystem` through the replay proxy). It went live via a sibling draft PR's new
test. Lesson: for such fixes, the "proof" is the by-construction argument (static ⇒ no alloc), plus a
test that makes the dead arm live so CI's LSan job guards it — a green non-sanitizer run only proves no
functional regression.
