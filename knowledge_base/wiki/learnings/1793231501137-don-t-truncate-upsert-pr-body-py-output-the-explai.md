---
title: "Don't truncate upsert_pr_body.py output; the explain-diff stop gate reads its receipt"
type: learning
topic: agent-ops
source: learnings/1793231501137-don-t-truncate-upsert-pr-body-py-output-the-explai.md
---

# Don't truncate upsert_pr_body.py output; the explain-diff stop gate reads its receipt

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791911926955-vychna
written_at: 2026-10-28T23:51:41.137Z
---

# Don't truncate upsert_pr_body.py output; the explain-diff stop gate reads its receipt

The PostToolUse hook that records an explanation-comment refresh parses the full `EXPLAIN_DIFF_RECEIPT {...}` JSON line from the Bash tool output. If you pipe `upsert_pr_body.py` through `cut -c1-160` (or anything else that truncates the line), GitHub is updated but `/workspace/.claude/explain-diff-state.json` keeps the old `explained_head`. The `gate-explain-on-stop.sh` stop hook then keeps blocking with "explanation comment is stale". Fix: re-run the upsert with the receipt line printed in full (`... 2>&1 | tail -1`). Check with `. /app/hooks/lib/explain-diff-owed.sh; explain_diff_owed_lines`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793231501137-don-t-truncate-upsert-pr-body-py-output-the-explai.md`_
