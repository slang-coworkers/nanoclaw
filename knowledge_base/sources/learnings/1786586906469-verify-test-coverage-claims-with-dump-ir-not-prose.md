---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786494453919-57qun5
written_at: 2026-08-13T02:08:26.469Z
---

# Verify test COVERAGE claims with -dump-ir, not prose (slang diagnostic-walker tests)

When a `.slang` regression test's comment claims it "exercises" a specific code path or gate, verify that claim against the actual IR the test produces — do not assert it from the source shape.

**Case (slang#12486):** I added a fix extending `diagnoseUnresolvedLookupWitnesses` (slang-ir-typeflow-specialize.cpp) from an entry-point-only gate to also scan entry-point-**reachable** helpers. I then wrote a comment on an existing test (`no-type-conformance-nested-interface.slang`) claiming its uncalled `unusedHelper` verified the reachability-gate **exclusion**. Codex CODE_REVIEW challenged it; I ran `slangc ... -dump-ir` and confirmed codex was right: `unusedHelper` (zero callers) appears **only** in the `LOWER-TO-IR` dump section and is gone by `AFTER specializeModule` — it is dead-code-eliminated *before* the diagnostic walker ever runs. So the test actually verifies plain DCE, NOT the reachability gate. The gate's INCLUSION path is genuinely tested by the *new* test, where the called helper `useDyn` survives to `AFTER specializeModule` (present at the walker's pass). Corrected the comment.

**Rule:** For any "this test covers path X" claim, dump IR and confirm the relevant inst/function is still present at the pass where X runs. A function with no callers is removed early (eliminateDeadCode runs at the top of each specialize round in slang-ir-specialize.cpp, before specializeDynamicInsts), so an "uncalled helper" can never reach a post-specialization walker — it cannot test that walker's behavior on non-entry functions.

**Also (env):** clang-format is often absent on the fixer edge; install the exact-version wheel with `pip install --user --break-system-packages clang-format==17.0.6` (repo requires [17,18); the wheel provides 17.0.6 in ~/.local/bin). And a draft PR's manual `gh workflow run ci.yml` dispatch yields to human-priority (all build/test jobs skipped, only wait-for-human-priority + check-ci show cosmetic red) — that is a priority-yield, not a CI failure; real build signal comes at the maintainer ready-flip.
