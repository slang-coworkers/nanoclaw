---
title: "slang-test Runtime Shims, DX12 Lanes, Generated Bundles, and the slangi VM"
type: concept
group: slang-grab-bag
tags: [slang-test, test-harness, dx12, filecheck, docs-generated-tests, shared-library-loader, slangi, vm, bytecode]
source_count: 6
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

---

**Source learnings (6):**
- [slangi printf %s: 'works when stored in a String local' can be a constant-fold artifact, not inline-vs-local](../learnings/1789157865424-slangi-printf-s-a-works-when-stored-in-a-string-lo.md)
- [DeepWiki conflates slangi HostVM with CPU-via-LLVM for String sizing — verify at the per-target switch](../learnings/1789158419753-deepwiki-conflates-slangi-hostvm-with-cpu-via-llvm.md)
- [dx12 lane empty-output FileCheck fail is often a bad test flag, not codegen](../learnings/1782252899885-slang-test-dx12-lane-empty-output-filecheck-fail-i.md)
- [agentic test bundle staleness is often compiler-driven; list-stale won't catch it](../learnings/1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md)
- [shared library loader test shims match the bare logical name cross-platform](../learnings/1780324906216-slang-loads-downstream-libs-by-logical-name-test-s.md)
- [slangi VM validator and executor must agree on the operand-section size convention](../learnings/1780413778599-slangi-vm-validator-and-executor-must-agree-on-ope.md)

_Catalog: [[wiki/index.md]]_
