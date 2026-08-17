---
title: "A local DiagnosticSink plus a nullptr outDiagnostics turns a compiler error into a silent nonzero exit"
type: learning
topic: slang-compiler
source: learnings/1785959064285-a-local-diagnosticsink-plus-a-nullptr-outdiagnosti.md
---

# A local DiagnosticSink plus a nullptr outDiagnostics turns a compiler error into a silent nonzero exit

Measured on shader-slang/slang @ master `b0e43d657` while scrubbing #6572.

## The shape
`slangc <shader> -target spirv -embed-downstream-ir -o out.slang-module` exits **255 with zero bytes on stdout AND stderr**. There is a real, well-formed diagnostic (`error[E50100]: no type conformances found`) — it is simply thrown away.

Mechanism, all verified at source:
- `Module::precompileForTarget` builds a **local** `DiagnosticSink` (`source/slang/slang-compiler-tu.cpp:111`) with no writer and no parent sink. `applySettingsToDiagnosticSink` (`slang-compiler-options.cpp:610`) only sets severity/format/colour — it installs neither.
- With `writer == nullptr`, diagnostics accumulate in `outputBuffer` (`slang-diagnostic-sink.cpp:600-612`).
- The only exposure is `sink.getBlobIfNeeded(outDiagnostics)` (`slang-compiler-tu.cpp:188`), and `getBlobIfNeeded` returns `SLANG_OK` immediately when `outBlob` is null (`slang-diagnostic-sink.cpp:574`).
- The CLI passes **`nullptr`** (`slang-end-to-end-request.cpp:240-241`) and `SLANG_RETURN_ON_FAIL` propagates a bare failure.

Generalises: **any `API(..., ISlangBlob** outDiagnostics)` called with `nullptr` from an internal call site is a diagnostic black hole.** Grep for `nullptr` at such call sites when a tool exits nonzero with no message.

## How to recover the swallowed message (~30 lines, no compiler change)
Build a probe against `include/slang.h` that calls the same API with a **real** blob. For this one the entry point is on an experimental interface, not `IModule`:

```cpp
Slang::ComPtr<IModulePrecompileService_Experimental> svc;
mod->queryInterface(IModulePrecompileService_Experimental::getTypeGuid(), (void**)svc.writeRef());
Slang::ComPtr<IBlob> diag;
SlangResult r = svc->precompileForTarget(SLANG_SPIRV, diag.writeRef());
// r = 0x80004005, diag = "error[E50100]: no type conformances found" x3
```
`g++ -std=c++17 -I include probe.cpp -o probe -L build/Debug/lib -lslang -Wl,-rpath,<abs>/build/Debug/lib`
Always pair with a **positive control** (an input you expect to succeed) so `SLANG_OK` + no diagnostics is a demonstrated outcome, not an untested branch.

## ⭐ The control that actually settled the triage
A silent nonzero exit is ambiguous: "the error channel is broken" vs "an assert/exception fired and got swallowed". Reading code cannot separate those — you need a **guilty control that throws in the same code path**. Sibling issue #6542's shape (a `ParameterBlock` global) run through the *same* `-embed-downstream-ir` invocation prints `error[E99997]: ... InternalError: unimplemented: Unhandled global inst in spirv-emit` (339 bytes). So the exception channel is demonstrably live ⇒ the silence on the other shader is a *dropped ordinary diagnostic*, not a hidden crash. Without that cell the conclusion was unsupported.

## Two traps that make the wrong conclusion look verified
1. **`SLANG_ASSERT=system` does nothing on Linux.** The `system`/`debugbreak` branches are inside `#if _WIN32 && defined(_MSC_VER)` (`source/core/slang-signal.cpp:112`); on Linux the value falls through to the ordinary path. "It didn't abort under `SLANG_ASSERT=system`" is **zero evidence** off Windows. Only `release-assert-only` is cross-platform.
2. **The `#ifndef _DEBUG` try/catch in `source/slangc/main.cpp:36` is not the catch boundary that matters.** `spCompile` → `EndToEndCompileRequest::compile()` catches `InternalError` at `slang-end-to-end-request.cpp:1911` guarded by a *different* macro, `SLANG_DEBUG_INTERNAL_ERROR` (not defined in a normal build — check `build/compile_commands.json`), and diagnoses at `:1941`. So an escaping assert **is** visible even in Debug. Reasoning from the `main.cpp` guard alone gets the polarity of the evidence backwards.

## Exit-code note
Exit 255 is nonspecific: every failed `spCompile` is rewritten to `SLANG_E_INTERNAL_FAIL` (`slangc/main.cpp:46`) → `ToolReturnCode::CompilationFailed = -1` (`slang-test-tool-util.cpp:11`, `.h:18`) → shell 255. It distinguishes nothing — never infer a failure *kind* from it.

## Also: the exception diagnostic renumbered
Issues filed before ~2026 quote `error 99999` for "compilation aborted due to an exception". It is now **99997** (`slang-diagnostics.lua:5904`); 99999 is reserved for other internal diagnostics. Grepping an old issue's `99999` against current output gives a false negative.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785959064285-a-local-diagnosticsink-plus-a-nullptr-outdiagnosti.md`_
