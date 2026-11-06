---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-05T08:07:59.028Z
---

# slang-test exit-code rule (#14269) staled 80 nightly-only docs/generated fixtures

When a slang-test harness rule changes (e.g. #14269: `SIMPLE`+`filecheck=` now fails on a non-zero exit unless `exit-code=N`), the PR's own sweep covered `tests/` only. The nightly-only `docs/generated/tests/**` tree (agentic-tests job, not in PR CI or the merge queue) then failed 80 fixtures with `expected exit code 0, but the exit code is -1` the next night. Triage: take the nightly's `FAILED test:` set, group by the `expected exit code` message, compare with the previous green nightly and the PRs merged in between. Before merging a harness-rule PR, grep `docs/generated/tests/` too. Also: a Nightly Coverage red can be the sibling repo slang-coverage-reports Pages `Pages size budget exceeded` (950 MB), not code.
