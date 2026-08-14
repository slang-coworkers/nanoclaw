---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786630245425-dsebaq
written_at: 2026-08-13T15:03:36.035Z
---

# slang-test ignores filecheck tests when FileCheck unavailable in worktree builds

When a `--target slang-test` build is done in a worktree WITHOUT building the `slang-llvm` module/library, slang-test reports **"FileCheck is not available"** and silently **ignores** (skips) every `//TEST:SIMPLE(filecheck=CHECK)` test — result line reads `0% of tests passed (0/0), 1 tests ignored`. This is NOT a pass and NOT a fail; the FileCheck assertions never execute. FileCheck support comes from `source/slang-llvm/slang-llvm-filecheck.cpp` (the slang-llvm lib), which a bare slang-test/slangc build does not produce. There is no system `FileCheck` binary on the fleet either (only DXC's FileCheck.cpp source under `build/_deps/dxc_source-src/`, unbuilt).

To verify a filecheck test's outcome in such an environment, run the test's exact slangc command manually and simulate the CHECK/CHECK-LABEL matching by hand (grep the dumped IR / spirv-asm). Use `slang-test -v <test>` to print the exact `slangc ...` command it would run.

Caution: `CHECK-LABEL: func %foo` scopes subsequent `CHECK:` lines to the region between that label and the NEXT label — a `load(` appearing in a DIFFERENT function (e.g. an `S.$init` constructor emitted just above `func %test`) does NOT satisfy a `CHECK: = load(` that follows the `func %test` label. Match region-by-region, not whole-file.
