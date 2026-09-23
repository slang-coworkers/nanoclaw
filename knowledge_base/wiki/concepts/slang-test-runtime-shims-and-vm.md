---
title: "slang-test Runtime Shims, DX12 Lanes, Generated Bundles, and the slangi VM"
type: concept
group: slang-grab-bag
tags: [slang-test, test-harness, dx12, filecheck, docs-generated-tests, shared-library-loader, slangi, vm, bytecode]
source_count: 8
---

# slang-test Runtime Shims, DX12 Lanes, Generated Bundles, and the slangi VM

A small cluster of runtime-facing slang-test gotchas: reading a DX12 empty-output FileCheck failure correctly, why auto-generated test bundles go stale for compiler-driven reasons, how a shared-library-loader test shim must name the library, and the operand-section invariant a slangi VM opcode's validator and executor must share.

## TL;DR

- **An empty-output FileCheck failure in a `-dx12` `COMPARE_COMPUTE` lane is usually an arg-parse failure (error 1004, unknown option), not a codegen/runtime bug** — `-use-dxil` is not a valid slang-test flag for dx12 since DXIL is already the default. Read the ACTUAL block first.
- **Stale auto-generated test bundles in `docs/generated/tests/` are usually compiler-driven** (diagnostic-text drift, IR mangled-name drift), so `regenerate.py list-stale` won't detect them. No hand-editing — route to the regeneration workflow.
- **A test shim for `ISlangSharedLibraryLoader` must match the bare logical name** (e.g. `"slang-llvm"`) — platform decoration happens inside `DefaultSharedLibraryLoader` after your shim sees the path, and the bare name is identical on all platforms.
- **A VM opcode validator and its executor must agree on the operand-section size convention**, or validation passes and execution crashes (e.g. printf with `%s` and string literals).

## DX12 Lane: Empty Output FileCheck Failure

An empty-output FileCheck failure in a dx12 `COMPARE_COMPUTE` lane is usually an **arg-parse failure** (error 1004: unknown option), not a codegen/runtime bug. `-use-dxil` is not a valid slang-test flag for dx12 since DXIL is already the default. Always read the ACTUAL block first ([slang-test -dx12 lane: empty-output FileCheck fail is often a bad test flag, not codegen — read the ACTUAL block](../learnings/1782252899885-slang-test-dx12-lane-empty-output-filecheck-fail-i.md)).

## Agentic Test Bundle Staleness

Stale auto-generated test bundles in `docs/generated/tests/` are often caused by **compiler diagnostic/IR changes**, not doc changes, so `regenerate.py list-stale` won't detect them. Two failure-mode classes: diagnostic-text drift and IR mangled-name drift. No hand-editing is permitted; route to the bundle regeneration workflow ([Agentic-test bundle staleness is often compiler-driven and list-stale won't catch it](../learnings/1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md)).

## Shared Library Loader Test Shims

When writing a test shim for `ISlangSharedLibraryLoader`, match against the **bare logical name** (e.g. `"slang-llvm"`) because platform decoration happens inside `DefaultSharedLibraryLoader` after your shim sees the path — the bare name is identical on all platforms ([Slang loads downstream libs by logical name — test shims match the bare name cross-platform](../learnings/1780324906216-slang-loads-downstream-libs-by-logical-name-test-s.md)).

## Slangi VM: Validator and Executor Must Agree

When a VM opcode validator special-cases an operand's section (e.g. treating `kSlangByteCodeSectionStrings` as `sizeof(const char*)`), the executor for that opcode must mirror the same convention. Asymmetry causes validation to pass but execution to crash (e.g. printf with `%s` and string literals) ([Slangi VM validator and executor must agree on operand-section size convention](../learnings/1780413778599-slangi-vm-validator-and-executor-must-agree-on-ope.md)).

This VM-vs-literal size gap has a concrete failure mode worth spelling out. On slangi (the HostVM bytecode interpreter) `kIROp_StringType` has NO configured size, so a *runtime* `String` value passed to `printf`'s `%s` segfaults. `slang-type-layout.cpp` defaults `stringSize=0` and its per-target switch has no `HostVM` case (`isCPUTargetViaLLVM` returns false for HostVM), so `slang-ir-layout.cpp` gives `kIROp_StringType` a size only `if (stringSize != 0)` — a runtime `String` lands in a 0-byte working-set slot and `%s` dereferences garbage as `const char*` → SIGSEGV. String *literals* work only because they route through the strings-section operand (`addStringLiteral`), and `kIROp_NativeStringType` is pointer-sized. The true axis is **runtime-value vs. constant-foldable-literal**, NOT inline-vs-local: a reporter's `(1<2)`-conditioned local const-folds to a literal and masquerades as a codegen distinction, so reproduce the full isolation matrix yourself before repeating an inline-vs-local hypothesis. DeepWiki is wrong here — it claims `String` is pointer-sized on HostVM, conflating it with the **CPU-via-LLVM** path (where `slang-llvm.cpp` genuinely sets `stringSize = genericPointerSize`); verify at the per-target switch and `isCPUTargetViaLLVM`, not DeepWiki. Prior fix #11399/#11415 covered only the literal path; the runtime-`String` sub-case (#13017) survived ([slangi printf %s 'works in a String local' can be a constant-fold artifact](../learnings/1789157865424-slangi-printf-s-a-works-when-stored-in-a-string-lo.md), [DeepWiki conflates slangi HostVM with CPU-via-LLVM for String sizing](../learnings/1789158419753-deepwiki-conflates-slangi-hostvm-with-cpu-via-llvm.md)).

## HostVM Early-Return in `linkAndOptimizeIR` Skips Emit-Time Checks; slangi Then Swallows the Diagnostic

The interpreter target has TWO ways to defeat an emit-time check, both surfaced verifying #13229 (`static_assert` as a decl). First, `linkAndOptimizeIR` (`slang-emit.cpp`) takes an **early `return SLANG_OK` for `CodeGenTarget::HostVM`** at ~`:1802` — it runs only `performForceInlining` + `cleanUpVoidType` + `simplifyIR`, then returns — so any pass or diagnostic *after* that point never runs for `slangi` / `//TEST:INTERPRET`. `checkStaticAssert`, the *only* site that evaluates/diagnoses a folded `kIROp_StaticAssert`, sits at ~`:2157`, well after the return; so on HostVM a failing `static_assert` silently passes, and a reachable function-body assert survives to VM byte-code emission where `slang-emit-vm.cpp` (`emitInst`, ~`:1224`) has **no `kIROp_StaticAssert` case** and aborts via `default: SLANG_UNIMPLEMENTED_X` — unlike `slang-emit-spirv.cpp` / `slang-emit-llvm.cpp`, which defensively ignore the op. When adding an emit-time check/cleanup that must apply to *all* targets, confirm it runs *before* the HostVM early-return (or is duplicated inside that branch); coverage that only exercises hlsl/glsl/spirv/-cpu misses the interpreter path — add a `//TEST:INTERPRET` case ([HostVM/slangi early-returns in linkAndOptimizeIR, skipping checkStaticAssert and later passes](../learnings/1790125505241-hostvm-slangi-target-early-returns-in-linkandoptim.md)).

Second, even when a codegen diagnostic *is* emitted, slangi can still swallow it: writing into the `sink` is **not enough** — you must also **return `SLANG_FAIL` when `sink->getErrorCount() != 0`**. `slangc` surfaces sink errors at the CLI layer *regardless* of the API return code (so `slangc -target slang-vm` failed loudly with E41400 and *masked* the bug), but `slangi` (`tools/slangi/main.cpp`) calls `maybePrintDiagnostic` only when `getTargetCode` returns FAILED; on `SLANG_OK` it discards the diagnostic blob and runs the (now assertion-free) byte code — as does any `getTargetCode` API consumer. The culprit was the HostVM branch's raw `return SLANG_OK` after the check, bypassing the `if (sink->getErrorCount() != 0) return SLANG_FAIL;` guard that the `SLANG_PASS`/`wrapPass` macro applies to every other pass. Lesson: test codegen diagnostics with the actual API consumer (`slangi` / `getTargetCode`), not just `slangc`; and any raw `return SLANG_OK` following a diagnostic-emitting step must carry the same error-count guard. (`kIROp_StaticAssert` is side-effecting — `default:` in `mightHaveSideEffects` — so it is NOT dropped by DCE/linking; the missing-guard hypothesis was right, the drop hypothesis wrong.) ([slangi swallows codegen diagnostics unless linkAndOptimizeIR returns SLANG_FAIL](../learnings/1790128010974-slangi-swallows-codegen-diagnostics-unless-linkand.md)).

---

**Source learnings (8):**
- [slangi printf %s: 'works when stored in a String local' can be a constant-fold artifact, not inline-vs-local](../learnings/1789157865424-slangi-printf-s-a-works-when-stored-in-a-string-lo.md)
- [DeepWiki conflates slangi HostVM with CPU-via-LLVM for String sizing — verify at the per-target switch](../learnings/1789158419753-deepwiki-conflates-slangi-hostvm-with-cpu-via-llvm.md)
- [dx12 lane empty-output FileCheck fail is often a bad test flag, not codegen](../learnings/1782252899885-slang-test-dx12-lane-empty-output-filecheck-fail-i.md)
- [agentic test bundle staleness is often compiler-driven; list-stale won't catch it](../learnings/1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md)
- [shared library loader test shims match the bare logical name cross-platform](../learnings/1780324906216-slang-loads-downstream-libs-by-logical-name-test-s.md)
- [slangi VM validator and executor must agree on the operand-section size convention](../learnings/1780413778599-slangi-vm-validator-and-executor-must-agree-on-ope.md)
- [HostVM/slangi target early-returns in linkAndOptimizeIR, skipping checkStaticAssert and later passes](../learnings/1790125505241-hostvm-slangi-target-early-returns-in-linkandoptim.md)
- [slangi swallows codegen diagnostics unless linkAndOptimizeIR returns SLANG_FAIL (slangc's CLI-layer error surfacing masks it)](../learnings/1790128010974-slangi-swallows-codegen-diagnostics-unless-linkand.md)

_Catalog: [[wiki/index.md]]_
