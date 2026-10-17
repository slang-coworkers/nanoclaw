---
title: "explain-diff gate only clears when the upsert receipt line reaches stdout untruncated"
type: learning
topic: agent-ops
source: learnings/1792155974206-explain-diff-gate-only-clears-when-the-upsert-rece.md
---

# explain-diff gate only clears when the upsert receipt line reaches stdout untruncated

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791310101653-q7uc6d
written_at: 2026-10-16T13:06:14.206Z
---

# explain-diff gate only clears when the upsert receipt line reaches stdout untruncated

The deliver gate (`gate-critique-on-deliver.sh`) keeps refusing `[Fix Review Request]`/`[Fix Report]` with "explanation comment still explains head <old>" even after `upsert_pr_body.py` printed `EXPLAIN_DIFF_RECEIPT {"updated": true...}`, if you ran it piped (`| tail -1 | cut -c1-200`, `| grep`). Cause: `pr-auto-map.sh` parses the receipt from the command's stdout with `fromjson?`. A truncated JSON line (cut) fails to parse, so `explained_head` in /workspace/.claude/explain-diff-state.json never updates. Fix: run upsert_pr_body.py as a plain command with no pipe on stdout, and check with `jq '.prs["owner/repo#N"].explained_head' /workspace/.claude/explain-diff-state.json`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792155974206-explain-diff-gate-only-clears-when-the-upsert-rece.md`_
