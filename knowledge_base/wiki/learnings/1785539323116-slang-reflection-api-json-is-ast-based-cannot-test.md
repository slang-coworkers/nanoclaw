---
title: "Slang reflection API/JSON is AST-based — cannot test IR-layout-internal bugs"
type: learning
topic: slang-compiler
source: learnings/1785539323116-slang-reflection-api-json-is-ast-based-cannot-test.md
---

# Slang reflection API/JSON is AST-based — cannot test IR-layout-internal bugs

When writing a regression test for a bug in the IR `IRTypeLayout` representation (e.g. attribute operand ordering, `getSizeAttrs()` contiguity), do NOT use a `//TEST:REFLECTION` test to catch it. The reflection API (`spReflectionTypeLayout_*` in slang-reflection-api.cpp) and the JSON emitter (`spReflection_ToJson`) operate on the **AST `TypeLayout`** (`convert(SlangReflectionTypeLayout*)` casts to the AST `TypeLayout*`, reads `resourceInfos` via `FindResourceInfo`) — NOT the IR `IRTypeLayout::getSizeAttrs()`. So an IR-layout bug is invisible to reflection.

PROOF (revert drill on PR #12306, 2026-07): reintroduced the `addAttrs` interleaving bug (alignment attr emitted between size attrs, breaking `findAttrs<IRTypeSizeAttr>` contiguity → `getSizeAttrs` truncates). A REFLECTION(filecheck) test asserting the struct's existential+uniform sizes ALL survive → PASSED under the buggy binary (reflection reads AST, unaffected). Only IR CONSUMERS (slang-ir-metadata.cpp:219 used-binding ranges, slang-ir-bind-existentials.cpp:219 slot binding) hit the truncation.

WHAT WORKS: a `//TEST:SIMPLE(filecheck=...):-dump-ir -o /dev/null` test that captures the `structTypeLayout(...)` OPERAND ORDER with FileCheck variable capture and asserts kind-by-definition:
  //CHECK: structTypeLayout([[S0:%[0-9]+]], [[S1:%[0-9]+]], [[S2:%[0-9]+]], [[A:%[0-9]+]]
  //CHECK-DAG: [[S0]]{{.*}}= size(
  //CHECK-DAG: [[S1]]{{.*}}= size(
  //CHECK-DAG: [[S2]]{{.*}}= size(
  //CHECK-DAG: [[A]]{{.*}}= TypeAlignment(16 : Int)
This is ID-agnostic (captures unstable %N), and FAILS under the bug (operand 2 becomes the alignment → `[[S1]]=size` fails). `-dump-ir` DOES print layout attrs as `let %N : Void = size(kind, val)` / `TypeAlignment(val)` / `structTypeLayout(...)`; the structTypeLayout USE line is printed BEFORE its attr-def lines, so capture-in-use then verify-in-defs with CHECK-DAG works.

Also: a C++ `slang-unit-test` calling `getSizeAttrs()` directly is blocked — the slang DLL is built `-fvisibility=hidden` (cmake/CompilerFlags.cmake:213), so non-`SLANG_API` IR methods don't link across the test-module boundary (unless the .cpp is recompiled into the test module, the isReproStateValid pattern).

ALWAYS run the revert drill (reintroduce the bug, rebuild, confirm the new test goes RED) before claiming a regression test guards an IR-internal invariant — a test that passes under both good and buggy builds is not a guard.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785539323116-slang-reflection-api-json-is-ast-based-cannot-test.md`_
