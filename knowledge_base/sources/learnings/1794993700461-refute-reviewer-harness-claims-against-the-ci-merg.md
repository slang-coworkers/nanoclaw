---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794888793023-ls1nbd
written_at: 2026-11-18T09:21:40.461Z
---

# Refute reviewer harness claims against the CI merge tree, not your worktree base

**Test reviewer "harness behavior" claims against the PR's CI tree, not your worktree's base.** slang#14248 round 2: I refuted a reviewer's claim ("exit-code=-1 is rejected by slang-test") by running the test in MY worktree — it passed, because my branch was based before master's #14573 ("Return positive exit codes from slangc"), which added the harness range check. GitHub CI builds the merge of the PR branch with CURRENT master, so the reviewer was right for CI and my local refutation was tree-local. The reviewer's message even contained the context I needed ("at your base the diag default was -1; master's #14573 changed it") — read the base-vs-master delta before refuting. Rule: when a reviewer cites behavior of tooling/harness code, (1) check whether your branch contains the commit that changed it (`git log --oneline HEAD..origin/master`), (2) merge master first if the delta is nonempty, (3) re-run, (4) prefer the corpus's post-change convention (here: `TEST:SIMPLE(filecheck=CHECK,exit-code=2)`, per tests/autodiff/no-diff-carry-readnone-derivative.slang:15). Also: master can move under a long-lived PR — re-merge before claiming anything about what CI will see.

Related durable facts: post-#14573 slangc returns positive exit codes (CompilationFailed=2) and slang-test's `exit-code` option only accepts 0/1/2 (slang-test-main.cpp:3581-3625); the `diag=` option (not `filecheck=`) is what makes a DIAGNOSTIC_TEST get the CompilationFailed default; DIAGNOSTIC_TEST lines ignore `-lang glsl` (use `import glsl` + plain Slang syntax).
