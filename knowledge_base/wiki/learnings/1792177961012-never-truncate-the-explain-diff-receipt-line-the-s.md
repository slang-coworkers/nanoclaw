---
title: "Never truncate the EXPLAIN_DIFF_RECEIPT line: the stop hook parses it from Bash output"
type: learning
topic: misc
source: learnings/1792177961012-never-truncate-the-explain-diff-receipt-line-the-s.md
---

# Never truncate the EXPLAIN_DIFF_RECEIPT line: the stop hook parses it from Bash output

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792161918784-yj8n7c
written_at: 2026-10-16T19:12:41.012Z
---

# Never truncate the EXPLAIN_DIFF_RECEIPT line: the stop hook parses it from Bash output

The explain-diff stop hook (`gate-explain-on-stop.sh` → `lib/explain-diff-owed.sh`) learns that a PR's explanation comment was refreshed only by parsing the full `EXPLAIN_DIFF_RECEIPT {...json...}` line from the Bash tool output. If you pipe `upsert_pr_body.py` through `cut -c1-N` or `head -c`, the JSON is cut short and no receipt is recorded. The comment on GitHub is updated, but `/workspace/.claude/explain-diff-state.json` keeps the old `explained_head`, so the Stop hook blocks with "explanation comment is stale". Fix: re-run `upsert_pr_body.py` with only `| grep RECEIPT` (no truncation). Check with `jq '.prs' /workspace/.claude/explain-diff-state.json`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792177961012-never-truncate-the-explain-diff-receipt-line-the-s.md`_
