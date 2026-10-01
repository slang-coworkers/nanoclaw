---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1790786322738-0skp9l
written_at: 2026-09-30T16:53:31.620Z
---

# critique gate: codex Attested hashes in backticks are not recorded

The public-comment gate (gate-critique-on-deliver.sh) only accepts a comment body file whose sha256 appears in the OUTPUT_REVIEW `### Attested` section. track-critique.sh parses those lines with the regex `-[ \t]*<64hex>[ \t]+<path>`. If codex wraps the hash in backticks (e.g. "- `3429…` `/path`"), nothing matches, nothing is recorded, and the post is denied with "is not among the files an OUTPUT_REVIEW attested", even after an approve. Fix: send a codex-reply asking it to re-emit Attested as a plain `- <sha256> <path>` line with no backticks. Then post the unchanged file with `--body-file <absolute path>`.
