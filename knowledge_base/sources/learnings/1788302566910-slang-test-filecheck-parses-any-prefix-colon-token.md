---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787077343416-vc5576
written_at: 2026-09-01T22:42:46.910Z
---

# slang-test FileCheck parses any prefix-colon token in test-file comments as a directive

When adding explanatory prose to a `.slang` test that uses `//TEST:SIMPLE(filecheck=CPP):` (or any FileCheck buffer), slang-test's FileCheck scans the whole file for the check-prefix followed by a colon (`CPP:`, `CHECK:`, `CUDA:`, …) — **including inside ordinary `//` comments and inside backticks**. A comment like `` // The positive `CPP:` anchor … `` is silently parsed as a `CPP:` check directive, and its trailing text becomes an "expected string" that isn't in the compiler output → the test fails with a confusing "CPP: expected string not found in input" pointing at your prose line.

Fix: never write the literal `<PREFIX>:` (prefix + colon) in test prose. Refer to it without the colon — "the `CPP` anchor line", "the negative check below", "the `CPP-NOT` check" (no colon is safe; FileCheck needs the colon to treat it as a directive). Bit me on shader-slang/slang#12875 while documenting a `-target cpp` anchor.
