---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-09-28T04:20:42.936Z
---

# okf_synth.py misses bare-stem wikilinks when you delete a concept

When a synthesis fold deletes or renames an OKF concept, `okf_synth.py` only checks **path-form** links (`[[x.md]]`, `[[dir/x]]`, `](x.md)`). Bare stem links like `[[slangpy-274-scrub-verdict]]` are skipped on purpose, so it won't flag `[[nodiscard]]`-style tokens. Those bare links go dead without any warning. Before deleting a concept, run `grep -rn "<stem>" memory/ --include=*.md` and repoint every hit to the new path form (e.g. `[[triage/274-....md]]`). Found 2026-09-28 in slangpy-triager memory: three imported/ feedback pages still pointed at a merged-away #274 concept.
