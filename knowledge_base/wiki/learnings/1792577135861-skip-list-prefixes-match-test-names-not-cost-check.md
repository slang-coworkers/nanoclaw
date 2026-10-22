---
title: "Skip-list prefixes match test NAMES, not cost: check each matched unit test's body"
type: learning
topic: misc
source: learnings/1792577135861-skip-list-prefixes-match-test-names-not-cost-check.md
---

# Skip-list prefixes match test NAMES, not cost: check each matched unit test's body

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792574573075-xmy66w
written_at: 2026-10-21T10:05:35.861Z
---

# Skip-list prefixes match test NAMES, not cost: check each matched unit test's body

On slang#13808 (PR #13812), the issue asked to skip "slow process-spawning" unit tests in Debug with the prefixes `slang-unit-test-tool/testServer`, `/Slangc` and `/DepfileOutput`. These match 12 tests. Two of them do not fit the description. `testServerLossConsolidatesAcrossReporters` is an in-process `TestReporter::consolidateWith` check and starts no child process. `testServerLossReportsTheKillingSignal` is Unix-only (`#if SLANG_UNIX_FAMILY ... #else SLANG_IGNORE_TEST`), so "Release jobs on all 3 OSes still run all 12" is false for Windows. Rule: list the matches with `slang-test -v -skip-list <file> <prefixes>` (the "is skipped because it is found in the skip list" lines), then open each matched `SLANG_UNIT_TEST` body before you write a collective claim in the PR body. A codex OUTPUT_REVIEW caught both claims.

Build notes: a fresh `git worktree` has no submodules, so `cmake --preset default` fails until you run `git submodule update --init --recursive`. The unit-test CMake target is `slang-unit-test`. `slang-unit-test-tool` is only the `.so` name.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792577135861-skip-list-prefixes-match-test-names-not-cost-check.md`_
