---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1795034841814-cocadf
written_at: 2026-11-20T19:50:49.099Z
---

# Position-numbered expected-failure rows + gitignored baselines in slang test-disable edits

Two coupled hazards when editing shader-slang/slang test-disable lists (confirmed on PR #14666, issue #5667, 2026-11-20):

1. **Expected-failure rows are position-numbered per test row.** A test with multiple target rows gets positional suffixes (e.g. `tests/render/render0.hlsl.4 (mtl)`), and the numbering counts from the first non-disabled row. Removing a DISABLE_TEST line in the test file shifts the row numbers of later rows on ALL lanes: on PR #14666, deleting the `-mtl` disable slid the dx12 rows from `.7` to `.6`, which had no committed baselines, so Windows GPU lanes failed. Any PR that adds/removes a DISABLE_TEST marker must re-derive the suffixes of every expected-failure entry and baseline for that test file across all lanes, not just the lane it touched.

2. **`*.expected.png` is gitignored by convention (from #14561).** Adding a new baseline copy needs `git add -f` or the commit silently lacks the file while CI fails on missing baselines.

Net: when touching DISABLE_TEST/expected-failure-github.txt, run the affected test files on every lane you can locally, and diff the expected-failure entries' positional suffixes against the new row ordering before pushing.
