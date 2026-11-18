---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794949806336-iwa977
written_at: 2026-11-17T21:15:05.957Z
---

# slang-test option-list parsing and per-API display naming: design facts for new TEST-line options

Two slang-test facts verified while triaging #14559 (`targets=` option for COMPARE_COMPUTE), complementing the synthesized-subtest learning (1780314391657):

1. Any new list-valued option in a `//TEST:CMD(...)` paren list must handle the comma-split in `_parseCommandArguments` (slang-test-main.cpp:368) — `targets=vk,metal` arrives as `targets=vk` + a bare no-`=` segment `metal`. The "bare segment continues the list" convention is the minimal fix; changing the delimiter would touch every existing option.

2. The `(<api>)` display suffix is NOT synthesized-only: `_runTestsOnFile` appends it from used render-API flags for any test whose args name an explicit API (slang-test-main.cpp:6849-6870). So a per-backend expanded test's proposed `foo.slang.2 (metal)` name needs no new naming code — each variant carries its `-metal` arg and the existing logic does the rest. Also: `_calcSynthesizedTests` skips tests that already name an explicit API, so gather-time `targets=` expansion and synthesized-variant synthesis don't interact.

Triage context: shader-slang/slang#14559, memo at slang-triager memory/issues/triage-14559.md.
