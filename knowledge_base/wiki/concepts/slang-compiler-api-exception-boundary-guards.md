---
title: "Slang public API exception boundaries: unguarded SLANG_NO_THROW methods, the link()-style guard, and how to test it"
type: concept
group: slang-compiler
tags: [slang, com-api, SLANG_NO_THROW, exceptions, AbortCompilationException, SLANG_EXCEPTION_TRY, SLANG_HAS_EXCEPTIONS, outputExceptionDiagnostic, getBlobIfNeeded, E39997, E99997, getTargetHostCallable, findAndCheckEntryPoint, getLayout, slang-unit-test, fno-exceptions]
source_count: 3
---

# Slang public API exception boundaries

A public COM method marked `SLANG_NO_THROW` promises that no C++ exception crosses the API
boundary. The compiler itself throws internally (a fatal diagnostic raises
`AbortCompilationException`), so every such method on a path that can throw needs its own
catch. This page records which methods lack one, which guard to copy, the traps in adding it,
and how a test can reach the bug.

## TL;DR

- **6 of 31 public `SLANG_NO_THROW` methods** on `IComponentType` / `IComponentType2` /
  `IEntryPoint` / `IModule` have no catch on a throwing path (master 56ff2a8338, #14448):
  `getLayout`, `findAndCheckEntryPoint`, `getTargetHostCallable`, `specialize`, `serialize`,
  `writeToFile`. The first three leak `AbortCompilationException` on a fatal E39997.
- **Copy the guard in `ComponentType::link`** (`slang-linkable.cpp:548-574`):
  `SLANG_EXCEPTION_TRY` plus `#if SLANG_HAS_EXCEPTIONS` arms for `AbortCompilationException`,
  `Exception` and `...`, each calling `outputExceptionDiagnostic`. Do not copy the plain `try`
  from the PR #12552 diff; PR #13244 replaced it so exceptions-off builds (#12779) compile.
- **A catch at the boundary is enough**: the escape does not poison the layout state.
- **Write `outDiagnostics` once, as the last statement inside the try.**
  `DiagnosticSink::getBlobIfNeeded` overwrites `*outBlob` without releasing it, so a throw
  after it leaks the first blob when the catch arm writes a second one.
- **A `.slang` test cannot reach these bugs**: slangc and slang-test go through the
  compile-request path, which already catches. Test the C++ API in `tools/slang-unit-test`,
  inside `#if SLANG_HAS_EXCEPTIONS`.
- **The `AbortCompilationException` and `Exception` arms give byte-identical blobs** for a
  fatal abort, so per-arm coverage is not a test gap.
- **A "module still usable after the abort" control must not use `[numthreads]`**, or
  `findAndCheckEntryPoint` returns early and skips validation.

## Which methods leak, and the guard to copy (#14448)

Consider a module whose struct chain is 127 levels deep. Compiling it hits the fatal E39997,
which throws `AbortCompilationException`. At master 56ff2a8338, `getLayout`,
`findAndCheckEntryPoint` and `getTargetHostCallable` each let that exception escape to the
caller. `getTargetHostCallable` goes around the guarded `getTargetArtifact` and calls
`getOrCreateWholeProgramResult` directly. The other three methods without a catch on a
throwing path are `specialize`, `serialize` and `writeToFile`
[SLANG_NO_THROW boundary-guard census](../learnings/1794352494547-slang-slang-no-throw-boundary-guard-census-14448.md).

The model is `ComponentType::link` (`slang-linkable.cpp:548-574`): `SLANG_EXCEPTION_TRY`, then
`#if SLANG_HAS_EXCEPTIONS` catch arms for `AbortCompilationException`, `Exception` and `...`
that each call `outputExceptionDiagnostic`. The plain `try` in the PR #12552 diff is the older
form; PR #13244 replaced it so the exceptions-off build (#12779) still compiles. The
accuracy traps in reviewing that series are on
[[wiki/concepts/review-pr-slang-review-lenses.md]]. The already-guarded `getEntryPointCode`
and `getTargetCode` have only one `catch (const Exception&)`; that arm wraps the real
diagnostic in an E99997 "aborted due to an exception of N5Slang25AbortCompilationExceptionE".

A boundary catch is a complete fix, not a mask: after the escape `m_layout` is still unset
(it is assigned only on success) and the `lock_guard` releases during unwind, so the next call
starts clean [census](../learnings/1794352494547-slang-slang-no-throw-boundary-guard-census-14448.md).
For the API's ownership and threading contracts, see
[[wiki/concepts/slang-compiler-api-ownership-and-frontend-guards.md]].

## Writing the guard: one diagnostics write, last

Check what runs after `sink.getBlobIfNeeded(outDiagnostics)` inside the try.
`getBlobIfNeeded` (`slang-diagnostic-sink.cpp`) does `*outBlob = blob.detach()` and never
releases the old value. In `getTargetHostCallable`, `artifact->loadSharedLibrary` runs after
it; if that throws, the catch arm's `outputExceptionDiagnostic` writes a second blob into
`*outDiagnostics` and the first one leaks. We write the blob once, as the last statement of the
try. `getTargetArtifact` handles the same problem with `if (outDiagnostics && !*outDiagnostics)`.
/code-review found this on slang PR #14450 (issue #14448)
[getBlobIfNeeded overwrites without releasing](../learnings/1794356463644-diagnosticsink-getblobifneeded-overwrites-outblob-.md).

## Testing the guard

A `.slang` regression test cannot reach these bugs, because slangc and slang-test enter
through the compile-request path, which already catches. The test calls the C++ API in
`tools/slang-unit-test`, inside `#if SLANG_HAS_EXCEPTIONS`
[test through slang-unit-test](../learnings/1794356463644-diagnosticsink-getblobifneeded-overwrites-outblob-.md).

Two traps from the PR #14450 review. First, a control that checks "the module is still usable
after an abort" by calling `findAndCheckEntryPoint` on a `[numthreads]` function tests nothing:
module load already registered that function as an entry point, so the call returns early
without validation. Leave `[numthreads]` off and assert
`module->getDefinedEntryPointCount() == 0` (details on
[[wiki/concepts/slang-compiler-linker-entry-point-checks.md]]). Second, for a fatal E39997 the
`catch (const AbortCompilationException&)` and `catch (const Exception&)` arms produce
byte-identical diagnostics blobs: the fatal text plus an `abort compilation: <same text>`
copy, which loadModule also prints. No test can tell the two arms apart, so missing per-arm
coverage is not a test gap
[the two arms are indistinguishable](../learnings/1794358871134-slang-numthreads-functions-are-registered-as-entry.md).

**Source learnings (3):**
- [Slang SLANG_NO_THROW boundary-guard census (#14448)](../learnings/1794352494547-slang-slang-no-throw-boundary-guard-census-14448.md) — 6 of 31 unguarded; copy `link()`'s three-arm guard, not #12552's plain `try`; boundary catch suffices
- [DiagnosticSink::getBlobIfNeeded overwrites *outBlob without releasing — write the blob once, last](../learnings/1794356463644-diagnosticsink-getblobifneeded-overwrites-outblob-.md) — PR #14450; test in slang-unit-test under `#if SLANG_HAS_EXCEPTIONS`
- [numthreads-attributed functions are entry points at module load; the two catch arms give identical blobs](../learnings/1794358871134-slang-numthreads-functions-are-registered-as-entry.md) — `findAndCheckEntryPoint` control skips validation; per-arm coverage is not a gap

_Catalog: [[wiki/index.md]]_
