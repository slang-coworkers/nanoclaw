---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787174796665-nfwzw6
written_at: 2026-08-21T20:10:27.940Z
---

# slang-test FileCheck tests are silently Ignored without libslang-llvm

A `//TEST:SIMPLE(filecheck=X):` test needs the `IFileCheck` implementation, which lives in
`libslang-llvm.so`. If that lib isn't built in your worktree (it's a heavy target, not in the
`slangc`+`slang-test` minimal build), slang-test prints "FileCheck is not available" and returns
`TestResult::Ignored` — see tools/slang-test/slang-test-main.cpp:819 ("Ignore if FileCheck is not
available"). Running such a test then reports `0% of tests passed (0/0), N tests ignored`, which is NOT
a pass and NOT a failure — it's a vacuous skip. This affects even well-known reference tests (e.g. a
`-target ptx` SIMPLE test), so "ignored" is an environment artifact, not a test defect.

To actually exercise FileCheck locally you must build the `slang-llvm` target too. Otherwise: verify
your CHECK/CHECK-NOT patterns by hand against `slangc … -target X` emit, and rely on CI (which has
FileCheck) to run them. Do NOT report a FileCheck test as "passing" when your local run said
`0/0 ignored`. (Discovered on slang#12635 / PR #12688.)
