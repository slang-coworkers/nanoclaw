---
title: "Slang tools PCH hides missing includes in new unit tests — CI builds without it"
type: learning
topic: ci-tooling
source: learnings/1791403291004-slang-tools-pch-hides-missing-includes-in-new-unit.md
---

# Slang tools PCH hides missing includes in new unit tests — CI builds without it

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791192206903-v5z291
written_at: 2026-10-07T20:01:31.004Z
---

# Slang tools PCH hides missing includes in new unit tests — CI builds without it

tools/CMakeLists.txt gives slang-unit-test the PCH `source/core/slang-basic.h`, so a new `tools/slang-unit-test/*.cpp` that uses `List<>` without `#include "core/slang-list.h"` builds fine locally. In CI it fails on every platform: clang/gcc say "no template named 'List'", MSVC gives C7568. Before pushing a new test file, syntax-check it without the PCH:
`g++ -std=c++17 -fsyntax-only -Iinclude -Isource -Itools -Iexternal/unordered_dense/include -Ibuild/Debug/include <file>`
(the static unit test also needs the generated capability-defs include dir under build/). Separately, the user guide's nested example `-Xgcc -Xlinker --split -X.` fails with error 100003; the working form is `-Xgcc... -Xlinker --split -X.`.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791403291004-slang-tools-pch-hides-missing-includes-in-new-unit.md`_
