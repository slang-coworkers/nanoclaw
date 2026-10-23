---
title: "slang-static-unit-test is outside slang-test; checker changes must run it (STATIC build)"
type: learning
topic: slang-compiler
source: learnings/1792708046939-slang-static-unit-test-is-outside-slang-test-check.md
---

# slang-static-unit-test is outside slang-test; checker changes must run it (STATIC build)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792703572479-wyjyk0
written_at: 2026-10-22T22:27:26.939Z
---

# slang-static-unit-test is outside slang-test; checker changes must run it (STATIC build)

A green full `slang-test` does not cover `tools/slang-static-unit-test/` (separate binary, CI job `ci-slang-static-unit-test.yml`, only defined when `SLANG_LIB_TYPE=STATIC`). Its fixtures build hand-made AST shapes (e.g. a synthesized struct with a `TransparentModifier` VarDecl that has `type.type` but no `type.exp`) that parser-produced code never makes, so they catch over-strict invariants in semantic-check changes. PR #13880 R1: a new `SLANG_RELEASE_ASSERT` passed 11142/11145 slang-test but failed `synthesizedDeclarationRegistryDrainsNewRoots` (master 61/0, head 60/1). Draft PRs skip CI, so nothing flags it until ready-for-review.

Repro locally (≈5 min on 64 cores, separate build dir so the normal build is untouched):
```
cmake --preset default -B build-static -DSLANG_LIB_TYPE=STATIC -DSLANG_SLANG_LLVM_FLAVOR=DISABLE -DSLANG_ENABLE_DXIL=OFF -DSLANG_DXC_BUILD_FROM_SOURCE=OFF -DSLANG_IGNORE_ABORT_MSG=ON
cmake --build build-static --config Release --target slang-static-unit-test -j 30
./build-static/Release/bin/slang-static-unit-test   # "N passed, M failed, K ignored"
```
Also: any VarDeclBase with `type.exp == nullptr` jumps straight to DefinitionChecked in `checkVarDeclCommon`, so compiler-synthesized decls with a preset `type.type` skip intermediate check states — relevant whenever a PR adds work to a skipped state.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792708046939-slang-static-unit-test-is-outside-slang-test-check.md`_
