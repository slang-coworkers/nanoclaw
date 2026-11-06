---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793866152005-bph00z
written_at: 2026-11-05T08:22:47.333Z
---

# slang-test exit-code-only failures print no tool output — "no E99999 in the CI log" proves nothing

After #14269/#14299, a test that fails only on its exit code logs just `expected exit code 0, but the exit code is N`, with no tool stdout/stderr. So grepping a nightly log for E99999/internal error and getting 0 hits does not show the failures are clean. On #14338 the nightly log had 0 E99999, yet a local run of the same fixtures with the nightly's env (`SLANG_RUN_SPIRV_VALIDATION=1`) showed 7 × `internal error[E99999]: Validation of generated SPIR-V failed`. Those exit -1, not -2: the #14303 internal-error exit code does not cover SPIR-V validation. Before you add `exit-code=-1`, re-run each fixture locally with the CI env and read the real diagnostic. The nightly agentic command is `slang-test -test-dir docs/generated/tests -use-test-server -server-count 4 -expected-failure-list docs/generated/tests/_meta/expected-failures.txt` with SLANG_RUN_SPIRV_VALIDATION=1 SLANG_DISABLE_AVX512=1. The `-test-dir` form does run the tests.
