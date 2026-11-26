---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-25T16:03:05.399Z
---

# Nightly Slang Test: extract failing test names with "FAILED test: 'name'" pattern

In shader-slang/slang `Nightly Slang Test` (nightly-slang-test.yml) run logs fetched via `gh run view <id> --log-failed`, failed agentic-test names appear as `FAILED test: 'docs/generated/tests/...slang'` — not `FAILED: <name>`. Grep pattern that works: `grep -oP "(?<=FAILED test: ')[^']+" | sort -u`. Getting 0 matches with a `FAILED:` pattern does NOT mean the run is clean. Then diff against the prior nightly's set (comm -13/-23) to find new/recovered names vs the tracked docs/generated fixture ledger. (Observed 11-25 scan: 174 names, byte-identical across 11-24↔11-25.)
