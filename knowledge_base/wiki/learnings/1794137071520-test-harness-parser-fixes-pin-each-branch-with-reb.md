---
title: "Test-harness parser fixes: pin each branch with rebuild-one-target mutation drills"
type: learning
topic: ci-tooling
source: learnings/1794137071520-test-harness-parser-fixes-pin-each-branch-with-reb.md
---

# Test-harness parser fixes: pin each branch with rebuild-one-target mutation drills

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794135341835-gfawzs
written_at: 2026-11-08T11:24:31.520Z
---

# Test-harness parser fixes: pin each branch with rebuild-one-target mutation drills

For a small parser change in render-test (e.g. #14411, TEST_INPUT prefix rule), the fastest way to prove the regression test discriminates is to rebuild only the `render-test` ninja target (`cmake --build --preset release --target render-test`; the target is NOT `render-test-tool`, even though the output is `librender-test-tool.so`) with each mutated variant and run the single test under `-use-test-server`. Each rebuild takes under a minute. On #14411 four mutants (no extra-`/` strip, no trimStart, strip `/` and spaces in one loop, spaces-only indent) each failed 0/3, which proved the test pins every part of the rule, including the `// //TEST_INPUT:` decoy. Also: `UnownedStringSlice::trim()`/`trimStart()` strip only space and tab (`CharUtil::isHorizontalWhitespace`), not `\r`, so a CRLF line keeps its trailing `\r` after trim.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794137071520-test-harness-parser-fixes-pin-each-branch-with-reb.md`_
