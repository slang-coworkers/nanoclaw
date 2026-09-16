---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789489021376-exztmn
written_at: 2026-09-15T16:57:35.857Z
---

# Round-2 PR review: delta-verify instead of full pipeline re-run when fix logic is unchanged

When a fixer resubmits a PR for a round-2 confirm and the diff shows the **fix logic is unchanged** (only tests/comments changed — check `gh pr diff` file list + `@@` hunks), a full re-run of the ~$8 Reviewer-A correctness pipeline (and Reviewer C) is disproportionate: A already validated that logic at 0 bugs in round 1. A cheaper, higher-signal round-2 delta-verification:

1. **Confirm HEAD** (`gh pr view <n> --json headRefOid`) and read the full new diff — verify the fix logic hunk is byte-identical to round 1 and only tests/comments moved.
2. **Verify diagnostic codes against source**, don't trust the fixer's summary. Slang diagnostics now live in `source/slang/slang-diagnostics.lua` (generated), keyed by numeric id: e.g. `err("type-doesnt-implement-interface-requirement", 38100, ...)` → E38100 "does not provide required interface member"; `30102` = "declaration not allowed here". Grep the numeric id in the .lua.
3. **Negative control on the already-built (unfixed) tree**: the standing `build/Release/bin/slangc` is usually at master (the checkout is detached master; grep for the fix to confirm it's absent). Run the new test shaders through it — a crash-fix regression test should reproduce the crash (exit 139) unfixed. This proves the tests are genuine guards AND that they parse/check up to the crash point. `slangc <test.slang> -target spirv -entry computeMain -stage compute` (slangc ignores `//TEST` comment lines).
4. **Fixed-build test run when cheap**: if `git merge-base <built-master-sha> <PR-head>` == the built master sha, the PR branch is just master+diff → incremental rebuild recompiles only the changed TUs. `git checkout <PR-head>`, `cmake --build --preset release --target slangc --target slang-test`, run the tests via `slang-test` from repo root, then `git checkout <master-sha>` to restore the tree.
5. **Re-fetch Devin** (Reviewer B) — it auto-re-analyzes each new commit; cheap independent signal.

Be transparent in the verdict that round-2 was a delta-verification, not a fresh full A/C pipeline run, and offer the full run if the requester prefers. Devin's `devin-commit-status` frequently returns "unknown" via anonymous scrape — note it as a freshness caveat, not a failure.

Context: shader-slang/slang#13095 (local generic interface-conformance crash fix). Round-1 APPROVE_WITH_NITS → round-2 APPROVE after runtime-verifying unfixed-crashes/fixed-passes for both the compute and diagnostic tests.
