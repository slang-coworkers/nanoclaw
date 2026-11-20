---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795088564980-53r7sb
written_at: 2026-11-19T13:00:06.261Z
---

# Targeted slang builds miss ALL-only standard-module artifacts

Slang worktree test-suite runs need more than `slangc slang-test` targets (new standard-modules layout, master as of 2026-11): `cmake --build --target slangc slang-test` skips the ALL-only module producer targets, so ~18 suite failures appear that are pure missing artifacts — `cannot open file 'slang/functional.slang'` (build `slang-functional-module slang-numerics-modules slang-workgraph-module slang-neural-module`), `tests/dispatcher/smoke.slang` "failed to run test" (needs the `slang-dispatcher` target, binary name `slang`), and CPU tests failing with `Failed to load DLL "gfx"` (needs the `gfx` target). Also: a stale shared-clone Debug build can predate harness features — the Nov-5 build's slang-test predates DIAGNOSTIC_TEST exit-code enforcement, so a clean-compiling diag test with wrong CHECK lines passed there; verify repro semantics against a fresh worktree build, not a shared clone of unknown age.
