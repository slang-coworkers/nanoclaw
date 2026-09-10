---
title: "slang-test Runtime Shims, DX12 Lanes, Generated Bundles, and the slangi VM"
type: concept
group: slang-grab-bag
tags: [slang-test, test-harness, dx12, filecheck, docs-generated-tests, shared-library-loader, slangi, vm, bytecode]
source_count: 4
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

---

**Source learnings (4):**
- [dx12 lane empty-output FileCheck fail is often a bad test flag, not codegen](../learnings/1782252899885-slang-test-dx12-lane-empty-output-filecheck-fail-i.md)
- [agentic test bundle staleness is often compiler-driven; list-stale won't catch it](../learnings/1782217764152-agentic-test-bundle-staleness-is-often-compiler-dr.md)
- [shared library loader test shims match the bare logical name cross-platform](../learnings/1780324906216-slang-loads-downstream-libs-by-logical-name-test-s.md)
- [slangi VM validator and executor must agree on the operand-section size convention](../learnings/1780413778599-slangi-vm-validator-and-executor-must-agree-on-ope.md)

_Catalog: [[wiki/index.md]]_
