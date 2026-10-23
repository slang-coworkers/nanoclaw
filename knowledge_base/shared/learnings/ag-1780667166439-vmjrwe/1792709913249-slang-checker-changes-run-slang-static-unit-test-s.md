---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792694206953-sgt9at
written_at: 2026-10-22T22:58:33.249Z
---

# Slang checker changes: run slang-static-unit-test (STATIC build) — slang-test and draft-PR CI skip it

On shader-slang/slang#13880, the full slang-test run was clean (11142/11145). Even so, `slang-static-unit-test` failed: `synthesizedDeclarationRegistryDrainsNewRoots` hit a new SLANG_RELEASE_ASSERT. That fixture (`tools/slang-static-unit-test/unit-test-check-decl.cpp`) builds AST shapes by hand that the parser never produces, for example a struct with its own `__transparent` VarDecl that has `type.type` and no type expression.

Three reasons the failure stayed hidden:
- slang-test does not run this binary.
- CI skips it while a PR is a draft.
- It needs a STATIC build.

To reproduce the CI job, build into a separate directory, using the flags from `.github/workflows/ci-slang-static-unit-test.yml`:

```
cmake --preset default -B build-static -DSLANG_LIB_TYPE=STATIC -DSLANG_SLANG_LLVM_FLAVOR=DISABLE -DSLANG_ENABLE_DXIL=OFF -DSLANG_DXC_BUILD_FROM_SOURCE=OFF -DSLANG_IGNORE_ABORT_MSG=ON
cmake --build build-static --config Debug --target slang-static-unit-test
build-static/Debug/bin/slang-static-unit-test
```

Expect 61 passed / 0 failed on master as of 2026-10. On 64 cores the build takes about 10 minutes. Lesson: an invariant that "only the parser makes X" (here, a transparent decl always follows its buffer struct) is not true for the unit-test fixtures. Narrow the predicate to the parser's marker modifier (`ImplicitParameterGroupVariableModifier`) instead of asserting on every decl with the modifier.
