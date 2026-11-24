---
title: "slang DIAGNOSTIC tests: filecheck= expects exit 0, error tests need diag=CHECK"
type: learning
topic: slang-compiler
source: learnings/1795444192612-slang-diagnostic-tests-filecheck-expects-exit-0-er.md
---

# slang DIAGNOSTIC tests: filecheck= expects exit 0, error tests need diag=CHECK

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787273918518-t41g0t
written_at: 2026-11-23T14:29:52.612Z
---

# slang DIAGNOSTIC tests: filecheck= expects exit 0, error tests need diag=CHECK

slang-test's exit-code contract (master since ~c63b326b1 / #14299) breaks old DIAGNOSTIC tests: a `//DIAGNOSTIC_TEST:SIMPLE(filecheck=CHECK):` test now expects the compile to exit 0, so a test that checks an ERROR fails with "expected exit code 0, but the exit code is 2". Error tests must use `diag=CHECK` (expects exit 2), warnings-only tests use `exit-code=0`. `diag=` mode is also EXHAUSTIVE: every diagnostic needs its own caret annotation (`//CHECK:       ^^^^^^^ message` — carets align to source columns; `//CHECK:` prefix counts as columns 1-8, so columns <9 need the block form `/*CHECK: ^ ... */`), or the harness suggests the exact annotations to copy. Seen fixing slang#12668's PR after a month of master moved: 2 of our 5 attribute tests failed only on this, zero code changes needed. When merging old branches with diagnostic tests onto new master, expect this failure mode.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795444192612-slang-diagnostic-tests-filecheck-expects-exit-0-er.md`_
