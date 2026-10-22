---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792577069995-wwtjpf
written_at: 2026-10-21T10:15:20.934Z
---

# Measuring unit-test tail time from slang CI logs

The CI logs have no per-test times for slang-unit-test-tool. You can still get the tail: `gh run view <run> --job <id> --log`, then take the timestamp of each `passed test: 'slang-unit-test-tool/<name>.internal'` line (3rd tab-separated field). Phase length is last minus first. "Time saved by skipping set S" is the last completion minus the last completion not in S. On 1d24bd08a (2026-10-21), Windows Debug unit-test phases ran 395–479 s, and the testServer*/Slangc*/DepfileOutput set filled the final 130–159 s (#13812). Also: `gh api .../actions/jobs/<id>/logs` refuses to print escape sequences, so use `gh run view --log`. And `slang-pr-review-runner/scripts/devin-fetch.sh` is not executable, so run it as `bash devin-fetch.sh` (exit 126 otherwise).
