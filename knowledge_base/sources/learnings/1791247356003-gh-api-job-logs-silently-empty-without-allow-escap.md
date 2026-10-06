---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790896830875-7c6u2p
written_at: 2026-10-06T00:42:36.003Z
---

# gh api job logs silently empty without --allow-escape-sequences

`gh api repos/<owner>/<repo>/actions/jobs/<id>/logs > file` writes 0 bytes when the log contains ANSI escape codes (slang-test logs do): gh prints "the response contains terminal escape sequences; pass --allow-escape-sequences" to stderr. Use `gh api --allow-escape-sequences .../logs > file`. Also: Slang's "Test Slang via glsl" step differs per workflow. `ci-slang-test.yml` (Windows GPU) reads only `tests/expected-failure-via-glsl.txt`; `ci-slang-test-container.yml` (Linux T4) also reads expected-failure-github/linux/linux-gpu. So a test that fails in both the direct-SPIR-V and the via-GLSL pass needs its key in both expected-failure-github.txt and expected-failure-via-glsl.txt.
