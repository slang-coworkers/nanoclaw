---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788249332526-y9k3ch
written_at: 2026-09-02T11:18:16.374Z
---

# Test-observability counters on libslang-internal classes must be SLANG_API-exported accessors, not plain class statics (-fvisibility=hidden → per-DSO copies)

**Context:** shader-slang/slang PR #12863 (record-replay leak fix). Needed a deterministic in-test guard that a per-call `ReplayNullFileSystem` stand-in (constructed inside libslang, in `GlobalSessionProxy::createSession`'s playback arm) is created and then freed.

**Gotcha:** The Slang build sets `CXX_VISIBILITY_PRESET hidden` + `VISIBILITY_INLINES_HIDDEN ON` (`cmake/CompilerFlags.cmake:~189-194`; also `LLVM.cmake:80`). A plain `static std::atomic<int> Foo::s_liveCount;` on a class defined in a record-replay header therefore gets a **separate hidden copy per DSO**. If the object is constructed in **libslang.so** but the counter is read from the separately-linked **slang-unit-test-tool** module (a MODULE that links `slang`), the two reference *different* symbol instances → the test reads its own copy (always 0) → a `SLANG_CHECK(count >= 1)` **fails CI**. This is the same class of false-negative as an earlier `s_probeCount` counter probe.

**Fix / correct pattern:** Use a single `SLANG_API`-exported accessor with a function-local static, defined in a `.cpp` compiled into libslang. Example: `SLANG_API std::atomic<int>& testsOnlyReplayNullFileSystemLiveCount();` declared in the header, defined in `proxy-base.cpp`. Both modules then link the one exported symbol → shared counter. This is the same mechanism that makes `wrapObject`/`ReplayContext::get` work across the boundary, and matches the existing exported test hooks `SLANG_API testsOnlyGetReplayArenaAllocationSize()` / `RequireReplayArenaAllocation` (`replay-context.h:394,398`).

**Why the usual precedent misleads:** `ReplayContext::testsOnlyGetOrphanedRefCount` (`replay-context.h:633`) is `inline` and reads state on the **shared exported singleton** `ReplayContext::get()` — it's same-module (libslang) data reached via an exported accessor, so it never crosses the DSO boundary as a raw static. Don't generalize it to "a bare class static works for test observability" — it only works when the object is *also constructed in the test module* (like an in-test `TestFileSystem`/`TestOwningProxy` whose ctor/dtor run in the test TU).

**Rule of thumb:** if a test in `slang-unit-test-tool` must observe a counter mutated by code inside libslang, the counter must be an `SLANG_API`-exported symbol (accessor or data member), never a hidden-visibility class static.
