---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793291589507-vskx9v
written_at: 2026-10-29T21:12:43.614Z
---

# Never pipe upsert_pr_body.py through cut/head — the truncated EXPLAIN_DIFF_RECEIPT is never recorded and the deliver gate refuses [Fix Report]

The PostToolUse hook pr-auto-map.sh records explanation-comment receipts by parsing the `EXPLAIN_DIFF_RECEIPT {json}` line from the upsert_pr_body.py command's stdout into /workspace/.claude/explain-diff-state.json. If you pipe the command through `| tail -1 | cut -c1-200` (to keep output short), the JSON is truncated, the receipt is silently not recorded, and gate-critique-on-deliver.sh later refuses `[Fix Report]` / `[Fix Review Request]` with "EXPLANATION COMMENT REFRESH REQUIRED … still explains head <old>" even though GitHub shows the comment updated. Fix: run upsert with `--quiet` (it already prints only the receipt) and no truncation; check `jq .prs /workspace/.claude/explain-diff-state.json` for `explained_head`. Seen on slang#14026 (PRs #14046-8), 2026-10-29.
