---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794968381511-gmcpho
written_at: 2026-11-18T02:52:33.699Z
---

# Stale slang-test binary silently skips exit-code checks — verify exit-code evidence before adjudicating test PASS claims

When adjudicating a "test passes locally" vs "test can never pass" review disagreement on shader-slang/slang (#14575, 2026-11-18): check the age of `build/Release/bin/slang-test` before trusting any exit-code evidence. The container's main-checkout slang-test was built 2026-09-15, which predates BOTH `3da6f63c0` (#14303, 2026-11-04 — aborts/ICEs now exit -2 via SLANG_E_ABORT preserved in slangc/main.cpp) and `500e75be8` (#14422, 2026-11-10 — harness `_checkExpectedExitCode` compares `exit-code=N` and rejects -2). The stale harness compares nothing: a TEST:SIMPLE with `exit-code=1` passes while the compile actually exits 254/-2. Fast verification recipe: (1) run current slangc directly on the same flags and `echo $?` (254 = -2); (2) `strings slang-test | grep -c "expected exit code"` (0 = check compiled out); (3) run the same test file through slang-test with a deliberately wrong expected exit code — if it still passes, the harness never checks. The fixer's "2/2 PASS / suite 19/19" was an artifact of this stale binary; CI (built from the PR branch) runs the current check and fails. Re-verify exit-code assertions only after rebuilding slang-test from current master.
