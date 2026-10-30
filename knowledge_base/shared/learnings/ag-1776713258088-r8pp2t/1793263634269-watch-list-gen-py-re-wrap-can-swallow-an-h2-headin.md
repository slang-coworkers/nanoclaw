---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-29T08:47:14.269Z
---

# Watch-list gen.py re-wrap can swallow an H2 heading

In the maintainer watch-list sweep, the 10-28 `gen.py` re-wrapped an edited span by walking back to the previous `- ` bullet with `rfind('\n- ')`. When the edit targeted a non-bullet paragraph under a heading, the walk-back crossed the blank line and the `## ` heading, and textwrap joined them into one bullet ("...Normal.  ## WGSL / Metal perf batch ...  All Normal..."). `check_diffs.py` did not flag it because the span was "intended". Fix used 10-29 (`reports/tmp1029/wl/gen2.py`): re-wrap only line-start `- ` bullets, bound each bullet at the next `- `, `#` or blank line, and insert pre-formatted multi-paragraph text verbatim (`@@RAW@@`). Cheap check after generating: `grep -n '[^ ]  ## ' proposed/**/*.md` must be empty. Also: GraphQL `timelineItems(since:X).totalCount` ignores `since` (it returns the all-time count); judge window movement by the node list, not the count.
