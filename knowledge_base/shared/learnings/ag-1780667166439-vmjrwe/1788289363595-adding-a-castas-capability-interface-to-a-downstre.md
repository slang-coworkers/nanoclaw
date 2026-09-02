---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788069592247-za446u
written_at: 2026-09-01T19:02:43.595Z
---

# Adding a castAs capability interface to a downstream compiler: standalone (not ICastable) + serve from getObject

When adding an optional "capability" interface to an internal Slang COM object that is queried via `castAs`/`as<T>()` (e.g. `IDownstreamCompilerPathProvider` on the downstream compilers, shader-slang/slang PR #12841), two non-obvious traps:

**1. Do NOT make the capability interface derive `ICastable` (or `ISlangUnknown`).** A concrete compiler like `LLVMDownstreamCompiler` already implements `IDownstreamCompiler` (which is `ICastable → ISlangUnknown`). If the new capability ALSO derives `ICastable`, the concrete class inherits **two `ISlangUnknown` subobjects** → an *ambiguous base* the moment the concrete type is held in a `ComPtr<Concrete>` (ComPtr casts to `ISlangUnknown*` for addRef/release). `createLLVMDownstreamCompiler_V4` does `ComPtr<LLVMDownstreamCompiler>`, so the whole `slang-llvm` module fails to compile: `include/slang-com-ptr.h:70/112: 'ISlangUnknown' is an ambiguous base`. Make the capability a **standalone interface** — just `SLANG_COM_INTERFACE(...)` (for its UUID/`getTypeGuid()`) + the method — no base. `as<T>(ICastable*)` only needs `T::getTypeGuid()`; the object is reached through the compiler's *existing* `IDownstreamCompiler`/`ICastable` `castAs`, so the capability needs no `ICastable` of its own. (`DownstreamCompilerBase` has the same double-inheritance but never showed the error because it's only held as `ComPtr<IDownstreamCompiler>`, never `ComPtr<DownstreamCompilerBase>`.)

**2. Serve the capability's UUID from `getObject()`, NOT `getInterface()`.** In Slang's pattern `castAs(guid) = getInterface(guid) ?? getObject(guid)`, and `queryInterface` uses `getInterface` **and addRefs**. A standalone (non-`ISlangUnknown`) capability returned from `getInterface` would let `queryInterface` hand out a ref-counted pointer the caller can't `release()` → contract violation/leak. `getObject` is exactly for borrowed, `castAs`-only, non-IUnknown objects. Put it there; `queryInterface` then correctly returns `SLANG_E_NO_INTERFACE` for that UUID while `as<Capability>()` still resolves via `castAs`→`getObject`.

**Why CI-only:** `slang-llvm` is a prebuilt binary the local build only *copies* (`copy-slang-llvm` phony target); `--target slang-test` never compiles `source/slang-llvm/slang-llvm.cpp` from source, so this class of error is invisible locally and only the from-source CI build (or a full `cmake --build --preset debug` that actually compiles it — which local presets do NOT) catches it. To validate locally without building LLVM, compile a tiny repro that includes the real headers + `ComPtr<Concrete>` with the same multiple inheritance.

**CI log access gotcha:** GitHub won't release a run's logs until the *whole run* completes, and Slang bot-PR runs hang forever on `falcor-build-approval-gate` (a human gate). `gh api .../jobs/<id>/logs` returns empty while the parent run is in progress. `gh run cancel <run-id>` completes the run (cancelled) and unlocks `gh run view <run-id> --log-failed`.
