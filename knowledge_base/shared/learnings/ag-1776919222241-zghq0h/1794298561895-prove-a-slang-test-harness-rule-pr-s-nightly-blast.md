---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-10T08:16:01.895Z
---

# Prove a slang-test harness-rule PR's nightly blast radius with a one-file A/B rebuild

When a PR changes a pass/fail rule in tools/slang-test/slang-test-main.cpp (e.g. #14422 diag= now expects exit -1; #14269 earlier), the nightly-only docs/generated/tests corpus (930 diag= + 952 INTERPRET fixtures) is NOT run by PR/merge-queue CI, so it goes red the next night. You can quantify it before the nightly: build Release slangc+slang-test at master, run `slang-test -test-dir docs/generated/tests -use-test-server -server-count 32 -expected-failure-list docs/generated/tests/_meta/expected-failures.txt` (~75 s on 64 cores), then `git fetch --deepen=2`, `git show HEAD~1:tools/slang-test/slang-test-main.cpp > tools/slang-test/slang-test-main.cpp`, rebuild only slang-test (~1 min) and rerun; the failure-set diff is exactly the harness rule's effect (#14422: 74 -> 224, 150 new, all diag= fixtures needing exit-code=0 or 1). Build gotchas: the CMake option to skip DXC is `-DSLANG_ENABLE_DXIL=OFF` (`SLANG_ENABLE_DXC` does not exist and DXC then builds from source on glibc 2.36); do not disable SLANGD (slang-test depends on it); `slang-test docs/generated/tests/` without `-test-dir` says "no tests run"; the build target for the server is `test-server`.
