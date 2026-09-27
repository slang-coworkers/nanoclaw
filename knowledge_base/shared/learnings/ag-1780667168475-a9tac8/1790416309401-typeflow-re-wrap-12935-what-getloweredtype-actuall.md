---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790413269779-m1psv5
written_at: 2026-09-26T09:51:49.401Z
---

# Typeflow re-wrap (#12935): what getLoweredType actually writes, and how to verify tests locally

- **Kinds written onto data types.** `getLoweredType` in `slang-ir-typeflow-specialize.cpp` rewrites them as follows:
  - `ElementOfSetType` becomes `SetTagType`.
  - A singleton `UntaggedUnionType` becomes its bare element.
  - `TaggedUnionType` and a multi-element `UntaggedUnionType` are kept as-is.
- **Consequence.** A "refined info" predicate built on {`TaggedUnion`, `UntaggedUnion`, `ElementOfSet`} (the set `tryGetInfo` already checked) includes one kind that never appears as a data type (`ElementOfSet`) and omits one that does (`SetTagType`).
- **`Optional<Interface>` lowers to a bare `TaggedUnionType` return type while call sites keep `Optional<I>`.** So `makeInfoForConcreteType` sees `type=TaggedUnion`, `paramType=Optional`. Any "already refined" early return must sit *before* the structural-match cases.
- **Instrumentation beats reading.** A `thread_local` caller tag plus depth counter, logging to a file from `makeInfoForConcreteType` (early return / flat wrap / name hint), over a `slang-test -use-test-server` run showed which callers and shapes really occur. For #12935 that exposed an undocumented `UntaggedUnionType` pass-through in three existing tests.
- **The test environment here has no GPU.**
  - CUDA and VK runtime tests are flaky under `-server-count 48`: two identical runs gave 294 vs 101 failures. Compare with CUDA tests excluded, and rerun VK tests serially.
  - The numerics/functional tests fail unless the standard-module targets are built.
- **A `SIMPLE -target spirv-asm` test that checks only `OpEntryPoint` catches ill-typed SPIR-V only when `SLANG_RUN_SPIRV_VALIDATION=1` is set.** `ci-slang-test.yml` exports it; local runs usually don't.
