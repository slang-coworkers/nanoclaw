---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787094122618-6wk1uf
written_at: 2026-08-18T23:29:49.022Z
---

# [approver/challenger-miss] A real-but-pre-existing 🔴 on a strict-improvement fix is CHALLENGER_CONCERN, not BLOCK

**PR:** shader-slang/slang#12552 @ 5e96544fd8e2 ("Fix #12387: contain exceptions escaping Module::precompileForTarget"). Bot-authored fixer PR → production review skips → Devin-only fallback tier (harvest exit 20).

**Symptom / trap.** Devin raised a 🔴 Bug: "a failed precompile leaves hidden `DownstreamModuleExportDecoration` markers that change later compilations" (slang-compiler-tu.cpp catch arm). The fallback-tier mapping turns any 🔴 into a REQUEST_CHANGES verdict, and Step 2 turns a verified in-scope 🔴 into BLOCK. The naive move is to record BLOCK.

**Root cause of why BLOCK would be wrong.** Two facts, both requiring a source read (never a review-summary read):
1. **Pre-existing defect class.** The exact leak (a failure return that skips the trailing marker-cleanup loop) already existed at merge-base 37f3a4f4 on the `if (res != SLANG_OK) return res;` and `return SLANG_E_NOT_AVAILABLE;` early-returns. The PR does not introduce the class; it only adds one more failure path (the exception catch arm) that shares it.
2. **The PR is a strict improvement.** Before the PR, the exception path *terminated the host process* (exit 134) — there was no surviving module to corrupt. Converting that to a recoverable SLANG_FAIL is unambiguously better; the only genuinely-new wrinkle is that the stale-marker state becomes reachable in a surviving process.

Blocking a strict-improvement fix on a pre-existing/out-of-scope issue is a **false-BLOCK**. But the 🔴 guardrail forbids WOULD_APPROVE (investigation can never upgrade a doc carrying a 🔴). The honest residual is **ABSTAIN_POLICY / CHALLENGER_CONCERN**: a human adjudicates whether the newly-reachable stale-marker state gets a scope-guard here or as a follow-up.

**How to catch it.** For any Devin/CodeRabbit 🔴 on a fixer PR, before recording BLOCK run two checks: (a) `git show <merge-base>:<file>` and confirm whether the flagged failure mode already existed — if yes, it's pre-existing, not introduced; (b) ask what the flagged path did *before* the PR — if it crashed/terminated, the PR is a strict improvement even if the residual state is imperfect. Real-and-pre-existing-and-out-of-scope ⇒ CHALLENGER_CONCERN abstain, not BLOCK. Reserve BLOCK for a 🔴 the PR *introduces or worsens*.

**Fix / rule.** BLOCK requires a 🔴 the PR *causes*. A 🔴 that is real but pre-existing, on a path the PR strictly improves, resolves to ABSTAIN_POLICY:CHALLENGER_CONCERN (hand the residual to a human). Do not let two existing human MEMBER approvals (live_late) round the abstain up to approve — accuracy is measured, never rounded toward approve.

**Ancillary verified facts worth reusing.** `slang-unit-test` is glob-sourced: `slang_add_target(slang-unit-test …)` gives no EXPLICIT_SOURCE → cmake/SlangTarget.cmake:141 falls to `slang_glob_sources` → `file(GLOB_RECURSE … *.cpp CONFIGURE_DEPENDS)` (cmake/Glob.cmake). So a newly-added `tools/slang-unit-test/*.cpp` with a `SLANG_UNIT_TEST(...)` auto-compiles and auto-registers in CI — no explicit listing needed. This is how you confirm a diagnostic-bearing regression test actually runs.
