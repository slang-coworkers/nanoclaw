---
title: "macOS: hidden visibility breaks cross-dylib typed catch of C++ exceptions (libc++abi RTTI-identity)"
type: learning
topic: misc
source: learnings/1783011716114-macos-hidden-visibility-breaks-cross-dylib-typed-c.md
---

# macOS: hidden visibility breaks cross-dylib typed catch of C++ exceptions (libc++abi RTTI-identity)

**Symptom:** On macOS a `Slang::Exception`/`InternalError` thrown inside `libslang.dylib` cannot be caught BY TYPE in another dylib (e.g. `libslang-unit-test-tool.dylib`) — the typed `catch (const InternalError&)` never matches and the exception escapes to the outer `catch (...)`. Linux (libstdc++) and Windows (MSVC) are unaffected. Surfaced by the six `replayStreamRejects*` unit tests failing only on the coverage nightly (in-process unit tests); per-PR CI masked it via a separate retry bug (slang #11911).

**Root cause (verified @slang 4ed7d3cfc):** Slang builds `-fvisibility=hidden` project-wide (`cmake/CompilerFlags.cmake:189` — `CXX_VISIBILITY_PRESET hidden`). For a class whose RTTI is hidden, clang emits the typeinfo *name* with a leading `*` — the Itanium C++ ABI "non-unique RTTI" marker meaning "compare by pointer identity only." Apple's libc++abi honors it, so with a private typeinfo copy per dylib the pointers never match across the boundary. libstdc++/MSVC compare exception types by NAME (strcmp of the mangled name), so they match regardless — that's why it's macOS-only.

**Fix pattern (principled, type-representation layer):** mark the exception base classes with default type visibility — `__attribute__((visibility("default")))`, no-op under `_MSC_VER`. That drops the `*` marker so the mangled name (`N5Slang13InternalErrorE`) is exported without the prefix and libc++abi falls back to name comparison across images. This is exactly why standard-library implementations export their exception types. Slang already had the precedent: `SLANG_REPLAY_EXCEPTION_API UntrackedInterfaceException` (`source/slang-record-replay/replay-context.h:89-96`); slang PR #11910 generalized it to `Exception`/`InvalidOperationException`/`InternalError`/`AbortCompilationException` in `source/core/slang-exception.h`.

**Triage takeaway:** any exception type meant to cross a shared-library boundary needs process-global RTTI identity (default type visibility), not just a name. When a "test-only" macOS failure traces to typed catch across a dylib, suspect visibility, not the test.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783011716114-macos-hidden-visibility-breaks-cross-dylib-typed-c.md`_
