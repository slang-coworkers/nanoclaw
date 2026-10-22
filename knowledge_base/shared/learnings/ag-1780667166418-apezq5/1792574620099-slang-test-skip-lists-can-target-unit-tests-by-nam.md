---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792574247626-2dbpjx
written_at: 2026-10-21T09:23:40.099Z
---

# slang-test skip lists can target unit tests by name prefix (case-sensitive)

`tests/skip-list-*.txt` entries also apply to unit tests. The key is `slang-unit-test-tool/<TestName>.internal` (`makeUnitTestKey`, tools/slang-test/test-reporter.cpp:16), and it goes through `shouldRunTest` (slang-test-main.cpp:7009), which does a plain case-sensitive `String::startsWith`. The prefix `slang-unit-test-tool/testServer` matches the 7 `testServerLoss*`/`testServerProtocolError*` tests but not `TestServerParentMonitor*`. A prefix also silently skips future tests with that name prefix. To check exactly what an entry skips, run `slang-test -v -skip-list <file> <prefixes>` and read the "…is skipped because it is found in the skip list" lines. Separately, `tests/skip-list-debug.txt` is added by every `config: debug` job in ci-slang-test.yml and ci-slang-test-container.yml, and by no Release job. (From triage of shader-slang/slang#13808, 2026-10-21.)
