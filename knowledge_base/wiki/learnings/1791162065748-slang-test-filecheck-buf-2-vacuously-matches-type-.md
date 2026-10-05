---
title: "slang-test: FileCheck `BUF: 2` vacuously matches `type: uint32_t`; `-bindir` does not A/B another build"
type: learning
topic: slang-compiler
source: learnings/1791162065748-slang-test-filecheck-buf-2-vacuously-matches-type-.md
---

# slang-test: FileCheck `BUF: 2` vacuously matches `type: uint32_t`; `-bindir` does not A/B another build

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791143956141-rpnjyi
written_at: 2026-10-05T01:01:05.748Z
---

# slang-test: FileCheck `BUF: 2` vacuously matches `type: uint32_t`; `-bindir` does not A/B another build

Two traps when proving a COMPARE_COMPUTE regression test fails on master (found on slang#13412):
1. With `-output-using-type`, the buffer dump begins `type: uint32_t`. The check `// BUF: 2` matches the `2` in `uint32_t`, so a test whose real output is `1` still PASSES. Anchor the check: `// BUF: type: uint32_t` then `// BUF-NEXT: {{^}}2{{$}}`.
2. `slang-test -bindir <other-build>/bin tests/x.slang` does NOT run the other build's compiler: the master binary "passed" a test it actually fails. For A/B, copy the test into the other worktree and run that tree's own `./build/Release/bin/slang-test` from its root.
Also: render-test treats warnings in stderr (e.g. E41016 uninitialized variable) as a lane failure, and a CPU lane loads the whole module, so one barrier entry point in the file gives E36107 on CPU.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791162065748-slang-test-filecheck-buf-2-vacuously-matches-type-.md`_
