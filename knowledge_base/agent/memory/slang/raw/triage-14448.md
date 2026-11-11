---
type: triage
title: "slang#14448 — AbortCompilationException (fatal E39997) escapes SLANG_NO_THROW getLayout / findAndCheckEntryPoint / getTargetHostCallable"
description: "Reproduced on HEAD 56ff2a8338 (fresh Release). Boundary-guard gap on 3 public methods; same defect class as #12387/PR #12552. Recommended: link()-style three-arm guard per method + no-GPU unit tests."
tags: [public-api, diagnostics, exceptions, reproduced, bug]
resource: scratch-14448/
---

# Triage: shader-slang/slang#14448 — `getLayout` and `findAndCheckEntryPoint` throw C++ exceptions on deeply nested types
Date: 2026-11-10T23:3xZ | bug | medium | P2 | frontend / public API boundary (layout + entry-point checking)
Reporter g-whiz (external, author_association NONE), filed 22:57Z, self-contained C++ repro. Duplicate: **no**.

## What's broken
A fatal diagnostic (39997 `maximum-type-nesting-level-exceeded`, `fatal(` in slang-diagnostics.lua:3771-3776)
calls `SLANG_ABORT_COMPILATION` → `Slang::AbortCompilationException` (derives from `Slang::Exception`, NOT
`std::exception`). Public methods declared `SLANG_NO_THROW` with no catch on the path let it escape the C ABI →
`terminate` (C++ w/o try) or "Rust cannot catch foreign exceptions, aborting". `link` and `getEntryPointCode` on the
same program return SLANG_FAIL + diagnostic.

## Repro (FACT, measured 2026-11-10 23:05Z)
Base clone HEAD = origin/master = `56ff2a8338`; `cmake --build --preset release --target slangc` ran 458/458 steps
(was stale), libslang-compiler.so mtime 23:03. Reporter's repro.cpp (copy in `scratch-14448/repro.cpp`) linked
against build/Release/lib:
| cmd | method | with try | -DNO_CATCH |
|---|---|---|---|
| `./repro 1` | IModule::findAndCheckEntryPoint (141-struct chain, varying param) | escaped (unknown type) | terminate AbortCompilationException, rc 134 |
| `./repro 2` | IComponentType::getLayout on linked Box<…>x300 | escaped | rc 134 |
| `./repro 3` / `3 127 sb` / `3 300 sb` | IModule::getLayout | escaped | rc 134 |
| `./repro 3 126` / `3 126 sb` (control) | getLayout | non-null, no diag | — |
| `./repro 3 128` (control) | loadModuleFromSourceString | null + E39997 (expected) | — |
Case 2 contrast: getEntryPointCode → 0x80004005 with `fatal error[E39997]` **plus** an `error[E99997] Slang compilation
aborted due to an exception of N5Slang25AbortCompilationExceptionE` wrapper (one-arm guard in
`getOrCreateEntryPointResult`, slang-target-program.cpp:162).

**Extra (FACT, found by census + probe `scratch-14448/probe2.cpp`):** `IComponentType2::getTargetHostCallable`
(target SLANG_SHADER_HOST_CALLABLE, 127-struct chain `uniform S0 u;` + trivial `[shader("compute")] main`, linked)
→ escaped; -no-catch variant rc 134 `terminate … AbortCompilationException`. Control chain(10) → SLANG_OK.

**State after escape (FACT, `scratch-14448/probe.cpp`):** 2nd getLayout on the same module throws again (no
half-built layout cached); other modules in same session still lay out fine, same thread and other thread → no
deadlock (`lock_guard` at slang-parameter-binding.cpp:4850 releases on unwind), no poisoning. A boundary catch is
sufficient; no state repair needed.

## Codebase digest (HEAD 56ff2a8338)
- `ComponentType::getLayout` slang-linkable.cpp:119-132 — local sink :127, `getOrCreateLayout(&sink)` :128, no try.
  `Module::getLayout` slang-module.h:65-69 forwards. `TargetProgram::getOrCreateLayout`
  slang-parameter-binding.cpp:4846-4874 (lock :4850, generateParameterBindings :4859, createIRModuleForLayout :4871).
- `Module::findAndCheckEntryPoint` public wrapper slang-module.h:158-175 → internal slang-module.cpp:116-151 (local
  sink :134, `findAndValidateEntryPoint` :145 → slang-check-shader.cpp:2929; getBlobIfNeeded only on normal return).
  Nothing cached on the module on that path (no `_addEntryPoint`).
- `ComponentType::getTargetHostCallable` slang-linkable.cpp:642-664 → `getOrCreateWholeProgramResult`
  slang-target-program.cpp:111-130 (no try; unlike `getOrCreateEntryPointResult` :148-169 which has one arm).
- Guard template: `ComponentType::link` slang-linkable.cpp:533-574 — `SLANG_EXCEPTION_TRY {…}` then
  `#if SLANG_HAS_EXCEPTIONS` three arms (AbortCompilationException / Exception / `...`) → `outputExceptionDiagnostic`
  + `return SLANG_FAIL`. Same in `precompileForTarget` slang-compiler-tu.cpp:~115/236-250 (post-#13244 form).
- Helper: `outputExceptionDiagnostic` 3 overloads, slang-diagnostic-sink.h:603-613 / .cpp:953-989 (non-static,
  namespace Slang, already used from slang-linkable.cpp). Reusable as-is. #12552 introduced **no new helper** — it
  applied this existing one. NB: a plain `try` copied from the #12552 diff breaks exceptions-off builds (#12779);
  copy the current `SLANG_EXCEPTION_TRY` form.
- Throw sites of 39997: slang-check-shader.cpp:525 (validateSystemValueSemantic; depth 128 at :99) + :718/:1430 etc.;
  slang-type-layout.cpp:5397 (`_createTypeLayout`, `kMaxTypeNestingDepth`); lower-to-ir.cpp:16135 (lowerTypeLayout).
- Origin of 39997: PR #10533 (merged 2026-03-18); more cap sites #10793/#10971/#11770/#11873/#13445. Neither method
  ever had a guard → **not a regression** of the guard; do NOT label `regression`.

## Census — public SLANG_NO_THROW methods (include/slang.h, IComponentType 5572-5758, IEntryPoint 5761-5766, ITypeConformance 5770-5773 (none), IComponentType2 5785-5817, IModule 5833-5891; 31 total)
- **GUARDED (10):** link, linkWithOptions (three-arm); getEntryPointCode, getResultAsFileSystem,
  getEntryPointHostCallable, getEntryPointMetadata, getEntryPointCompileResult (one `catch (const Exception&)` in
  getOrCreateEntryPointResult, slang-target-program.cpp:162); getTargetCode, getTargetMetadata,
  getTargetCompileResult (one arm in getTargetArtifact, slang-linkable.cpp:849). One-arm guards lack `catch (...)`
  and add the E99997 wrapper.
- **UNGUARDED, reaches diagnose (6):** strong & **trigger demonstrated**: `getLayout`, `findAndCheckEntryPoint`,
  `getTargetHostCallable`. strong, no trigger found: `specialize` (slang-linkable.cpp:462; parse/CheckTerm/
  generateIRForSpecializedComponentType; also named in #13351). weak (`SLANG_UNEXPECTED` only, no outDiagnostics):
  `IModule::serialize` (slang-module.cpp:279), `writeToFile` (:293).
- **UNGUARDED trivial (15):** getSession, getSpecializationParamCount, getEntryPointHash, renameEntryPoint,
  getFunctionReflection, findEntryPointByName, getDefinedEntryPoint(Count), getName, getFilePath,
  getUniqueIdentity, getDependencyFile(Count/Path), getModuleReflection, disassemble.
- ISession side notes (out of scope): getTypeLayout (slang-session.cpp:814; no sink → 39997 skipped, but
  SLANG_UNEXPECTED can throw InternalError), loadModuleInfoFromIRBlob (:504), createTypeConformanceComponentType
  (:1004 `catch (...) {}` swallows w/o diagnostic), specializeType (two arms, no Exception arm).
- Census method: grep -n over interface blocks; `catch (` counted with grep -rn (clauses) under source/slang:
  linkable.cpp 4, compiler-tu.cpp 3, target-program.cpp 1, session.cpp 12, module.{h,cpp}/entry-point/linkable-impls 0.

## Candidate approaches
### A: Per-method three-arm boundary guard (link() idiom) on the 3 demonstrated methods — RECOMMENDED
- Where: slang-linkable.cpp:119 (getLayout → nullptr), slang-module.cpp:116 internal findAndCheckEntryPoint (→ null
  RefPtr; wrapper turns into SLANG_FAIL; fill outDiagnostics in every arm), slang-linkable.cpp:642
  (getTargetHostCallable → SLANG_FAIL).
- Delta: SLANG_FAIL/nullptr + E39997 in diagnostics instead of process abort.
- Tradeoffs: ~3×15 lines, matches maintainer-endorsed idiom (#12552, tangent-vector); keeps one source of truth
  (outputExceptionDiagnostic). Abort arm re-adds e.Message → 39997 text appears twice in blob — same as link today.
- Risk: low. Guard in the internal findAndCheckEntryPoint (owns the sink) not the header wrapper.
### B: Shared boundary helper/macro (e.g. template `guardPublicApiCall(sink, outDiagnostics, failValue, fn)`) applied to all 6 unguarded + migrate link/precompileForTarget/one-arm sites
- Tradeoffs: removes duplication, fixes census-wide; but bigger blast radius, touches guarded code, new abstraction
  maintainers didn't ask for; serialize/writeToFile have no outDiagnostics. Good follow-up refactor, not this fix.
- Risk: medium (behaviour change on already-guarded paths: E99997 wrapper disappears).
### C: Make 39997 non-fatal / return error from the depth guards
- Rejected: fixes one diagnostic only; any other fatal/internal diagnostic or SLANG_UNEXPECTED on these paths still
  escapes; the depth cap exists to unwind runaway recursion, so non-fatal needs failure propagation through recursive
  layout/check code. Same reasoning that rejected #12387 approach B.
### D: One-arm guard inside internal TargetProgram::getOrCreateLayout / getOrCreateWholeProgramResult
- Covers getLayout + getTargetHostCallable + spGetReflection; but not findAndCheckEntryPoint; swallows at a
  non-boundary layer used by compile/emit paths (slang-emit.cpp:3030, end-to-end-request.cpp:308, compile-request.cpp:880)
  and reports via the E99997 wrapper. Medium blast radius; not principled layer.

## Recommended path (solution brief, ≤15 lines)
- **Hypothesis (confirmed):** `getLayout`, `findAndCheckEntryPoint`, `getTargetHostCallable` lack the API-boundary
  catch; fatal E39997 throws AbortCompilationException through `SLANG_NO_THROW`.
- **Files:** slang-linkable.cpp:119 & :642; slang-module.cpp:116 (internal overload, sink at :134).
- **Fix:** copy `ComponentType::link` (slang-linkable.cpp:548-574): `SLANG_EXCEPTION_TRY` + `#if SLANG_HAS_EXCEPTIONS`
  three arms → `outputExceptionDiagnostic(…, sink, outDiagnostics)`; return nullptr / null RefPtr / SLANG_FAIL.
- **Repro:** `memory/issues/scratch-14448/repro.cpp` cases 1/2/3 (+ `probe2.cpp` for host-callable), linked against
  build/Release/lib/libslang-compiler.
- **Accept when:** all 3 repro cases and probe2 return failure (nullptr / 0x80004005) with `E39997` in the blob,
  no exception, -DNO_CATCH exits 0; N=126 / chain(10) controls unchanged; new no-GPU unit test(s) in
  tools/slang-unit-test (mirror unit-test-precompile-exception-boundary.cpp, `#if SLANG_HAS_EXCEPTIONS`; see also
  unit-test-get-layout-after-error.cpp, unit-test-find-check-entrypoint.cpp) fail on master, pass with fix;
  revert drill per method; slang-unit-test-tool/ suite green.
- **Out of scope (list in PR as follow-up):** specialize, serialize/writeToFile, ISession::getTypeLayout, adding
  `catch (...)` to the one-arm guards, duplicate-message cosmetics, #13351, #8376.

## Sources
- DeepWiki Q1 (boundary convention: link/getTargetArtifact/loadModule use SLANG_EXCEPTION_TRY + outputExceptionDiagnostic);
  Q2 (getOrCreateLayout caching: m_layout only set after success; m_layoutHasErrors → nullptr; PR #13513 test).
- Precedents: #12387 / PR #12552 (merged 2026-08-19, tangent-vector "apply the idiom already in use elsewhere on the
  public API boundary"); #5950 / PR #6143 (csyonghe: boundary methods must catch Slang::Exception and ...);
  #6988 / PR #7627; PR #13244 (SLANG_EXCEPTION_TRY form, #12779 exceptions-off).
- Overlap: #13351 (OPEN; lists findAndCheckEntryPoint + specialize as unguarded, different trigger E15303 lazy AST);
  #8376 (OPEN, stale: unnamed method leaks AbortCompilationException from an ICE that no longer reproduces —
  same class, not a duplicate). PR #13513 (getLayout after errors; test template).
- Shared learnings: #12552 approver notes (pre-existing stale-marker finding → not BLOCK); "rethrow inside catch(...)
  makes a working guard look broken"; "test the public API directly, slang-test drives the guarded CLI".
