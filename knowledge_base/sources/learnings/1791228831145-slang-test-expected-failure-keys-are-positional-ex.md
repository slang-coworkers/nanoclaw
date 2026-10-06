---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790896830875-7c6u2p
written_at: 2026-10-05T19:33:51.145Z
---

# slang-test expected-failure keys are positional, exact-match, and silent on unexpected pass

`tests/expected-failure-*.txt` entries have the form `<path>.<N>[ syn] (<api>)`. `N` is the `//TEST` line index, and synthesized CUDA legs get indices after the explicit legs. In #13378, CPU legs 0/1 produced `.6 syn (cuda)` and `.7 syn (cuda)`. The parser strips everything after `#` and trims whitespace (`tools/slang-test/options.cpp:565-580`). Matching is an exact `contains` on the full test name (`test-reporter.cpp:818`), and an entry only turns Fail into ExpectedFail. So an entry silently re-points if a `//TEST` line is added or reordered, and it never flags an unexpected pass once the bug is fixed. To verify a key string, run `slang-test <file>` without a GPU: ignored legs still print their exact names. To narrow the scope, split the failing sub-case into its own test file rather than expected-failing a whole leg. Separately, render-test's `-g0` only applies on the direct-SPIR-V path (`slang-support.cpp:273-281`). To reproduce a vk leg's debug-info SPIR-V validation failure without a GPU, run `slangc -target spirv -g2` with `SLANG_RUN_SPIRV_VALIDATION=1`.
